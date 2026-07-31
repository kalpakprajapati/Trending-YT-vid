import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  ContentProvider,
  HackerNewsScraper,
  RedditScraper,
  RssScraper,
} from "./scrapers/index.js";
import type { ScrapedContent } from "./scrapers/types.js";
import { ScriptGenerator } from "./ai/script-generator.js";
import type { GeneratedScript } from "./ai/types.js";
import { TtsResult, VoiceGenerator } from "./voice/tts.js";
import { db } from "./db/client.js";
import { scrapedContent, videoProjects } from "./db/schema.js";
import type { Config } from "./config.js";
import { logger } from "./utils/logger.js";

import { VideoRenderer, VideoStyle } from "./video/renderer.js";

export class Pipeline {
  private scriptGen: ScriptGenerator;
  private voiceGen: VoiceGenerator;
  private videoRenderer: VideoRenderer;

  constructor(config: Config) {
    this.scriptGen = new ScriptGenerator(config.GEMINI_API_KEY || "");
    this.voiceGen = new VoiceGenerator({ geminiApiKey: config.GEMINI_API_KEY, geminiVoice: config.GEMINI_VOICE_NAME });
    this.videoRenderer = new VideoRenderer();
  }

  /**
   * Helper to get the right scraper. Defaults to HackerNews.
   */
  getScraper(source: string = "hackernews", config?: Config): ContentProvider {
    switch (source) {
      case "reddit":
        return new RedditScraper(config);
      case "rss":
        return new RssScraper();
      case "hackernews":
      default:
        return new HackerNewsScraper();
    }
  }

  // Run the full pipeline for one piece of content
  async processOne(
    content: ScrapedContent,
    style: VideoStyle = "gradient",
  ): Promise<any> {
    logger.info(
      `Processing single content: ${content.id} from ${content.source}`,
    );

    // 1. Check if it exists in DB (using url as a unique identifier for now, since ID might just be a number in HN)
    const existing = await db
      .select()
      .from(scrapedContent)
      .where(eq(scrapedContent.url, content.url));

    let dbContentId = "";
    if (existing.length === 0) {
      dbContentId = nanoid();
      await db.insert(scrapedContent).values({
        id: dbContentId,
        source: content.source,
        title: content.title,
        body: content.body || "",
        url: content.url,
        score: content.score || 0,
        commentCount: content.commentCount || 0,
        subreddit: content.category || "general",
        scrapedAt: new Date().toISOString(),
      });
    } else {
      if (existing[0].isProjectComplete) {
        logger.info(`Content ${content.url} is already completed. Skipping.`);
        return null;
      }
      dbContentId = existing[0].id;
      logger.info(`Content ${content.url} already exists in DB but not completed, resuming.`);
    }

    const slugify = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")
        .substring(0, 50);
    const projectId = `${slugify(content.title)}-${nanoid(4)}`;
    const projectDir = path.join(process.cwd(), "output", projectId);

    // 2. Generate script
    logger.info(`Generating script for ${projectId}...`);
    const scriptDir = path.join(projectDir, "scripts");
    await fs.mkdir(scriptDir, { recursive: true });

    const script = await this.scriptGen.generateScript(content as any);
    const scriptPath = path.join(scriptDir, "script.json");
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

    // Save YouTube metadata separately for easy copy-pasting
    const metadataContent = `
Title:
${script.title}

Description:
${script.description}

Tags:
${script.tags.join(", ")}
`.trim();
    const metadataPath = path.join(projectDir, "youtube_metadata.txt");
    await fs.writeFile(metadataPath, metadataContent);

    // 3. Generate voice
    logger.info(`Generating voiceover for ${projectId}...`);
    const audioDir = path.join(projectDir, "audio");
    await fs.mkdir(audioDir, { recursive: true });

    const ttsResult = await this.voiceGen.generateForScript(
      script,
      audioDir,
      projectId,
    );
    const audioPath = ttsResult.audioPath;

    // 4. Render video
    logger.info(`Rendering video for ${projectId}...`);
    const videoDir = path.join(projectDir, "videos");
    await fs.mkdir(videoDir, { recursive: true });

    // Create thumbnails folder
    const thumbnailDir = path.join(projectDir, "thumbnails");
    await fs.mkdir(thumbnailDir, { recursive: true });

    let videoPath = "";
    try {
      videoPath = await this.videoRenderer.renderVideo({
        projectId,
        script,
        audioPath,
        audioDurationMs: ttsResult.totalDurationMs,
        outputDir: videoDir,
        style,
      });
    } catch (e: any) {
      logger.error(`Failed to render video for ${projectId}: ${e.message}`);
    }

    // 5. Save project
    await db.insert(videoProjects).values({
      id: projectId,
      contentId: dbContentId,
      status: "draft",
      scriptJson: JSON.stringify(script),
      audioPath: audioPath,
      videoPath: videoPath || null,
      title: script.title,
      description: script.description,
      tags: JSON.stringify(script.tags),
      createdAt: new Date().toISOString(),
    });

    // Mark as completed
    await db.update(scrapedContent)
      .set({ isProjectComplete: true, usedAt: new Date().toISOString() })
      .where(eq(scrapedContent.id, dbContentId));
    logger.success(
      `Successfully processed ${content.id} into project ${projectId}`,
    );
    return {
      id: projectId,
      contentId: dbContentId,
      status: "draft",
      scriptPath: scriptPath,
      audioPath: audioPath,
      videoPath: videoPath,
    };
  }

  // Run the full pipeline: scrape -> filter -> generate scripts -> voice -> save
  async run(options?: {
    source?: string;
    limit?: number;
    category?: string;
    style?: VideoStyle;
  }): Promise<any[]> {
    logger.info("Running full pipeline...");

    const contents = await this.scrape(options);
    const projects = [];

    for (const content of contents) {
      try {
        const project = await this.processOne(content, options?.style);
        if (project) {
          projects.push(project);
        }
      } catch (error: any) {
        logger.error(
          `Error processing content ${content.id}: ${error.message}`,
        );
      }
    }

    logger.success(`Pipeline finished. Processed ${projects.length} projects.`);
    return projects;
  }

  // Individual steps (can be run standalone)
  async scrape(options?: {
    source?: string;
    category?: string;
    limit?: number;
  }): Promise<ScrapedContent[]> {
    const source = options?.source || "hackernews";
    logger.info(`Scraping content from ${source}...`);

    const scraper = this.getScraper(source);

    const contents = await scraper.fetchContent({
      limit: options?.limit || 5,
      category: options?.category,
      minScore: 100,
      minWordCount: 0,
    });

    logger.info(`Scraped ${contents.length} items.`);
    return contents;
  }

  async generateScript(content: ScrapedContent): Promise<GeneratedScript> {
    return this.scriptGen.generateScript(content as any);
  }

  async generateVoice(
    script: GeneratedScript,
    projectId: string,
  ): Promise<TtsResult> {
    return this.voiceGen.generateForScript(script, projectId);
  }
}
