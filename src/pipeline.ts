import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);
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
import { FFmpegRenderer } from "./video/ffmpeg-renderer.js";
import { generateSrt } from "./utils/subtitles.js";
import { checkbox } from '@inquirer/prompts';

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
    showSubtitles: boolean = false,
    format: 'vertical' | 'horizontal' = 'vertical'
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

    // Generate SRT subtitles
    const srtPath = path.join(videoDir, `${projectId}.srt`);
    await generateSrt(script, ttsResult.totalDurationMs, srtPath);
    logger.info(`Generated SRT subtitles at ${srtPath}`);

    let videoPath = "";
    if (style === "manual") {
      logger.warn(`[Manual Mode] Stopping before video render for ${projectId}.`);
      const promptsFile = path.join(projectDir, "google_flow_prompts.txt");
      
      const allParts: Array<{ text: string; prompt: string }> = [];
      if (script.hookLine) {
        allParts.push({ text: script.hookLine, prompt: script.hookImagePrompt || script.scenes[0]?.imagePrompt || script.hookLine });
      }
      for (const scene of script.scenes) {
        allParts.push({ text: scene.text, prompt: scene.imagePrompt || scene.text });
      }
      if (script.outro) {
        allParts.push({ text: script.outro, prompt: script.outroImagePrompt || script.scenes[script.scenes.length - 1]?.imagePrompt || script.outro });
      }

      const promptContent = allParts.map((s, i) => {
        const words = s.text.split(/\s+/).length;
        const estimatedSeconds = Math.max(Math.round(words / 2.5), 3); // 2.5 words/sec, min 3 seconds
        let promptWithFormat = s.prompt;
        if (format === 'horizontal') {
          promptWithFormat = promptWithFormat + ", horizontal 16:9 cinematic landscape";
        } else {
          promptWithFormat = promptWithFormat + ", vertical 9:16 cinematic portrait";
        }
        return `--- scene_${i}.mp4 (Estimated Duration: ~${estimatedSeconds} seconds) ---\n${promptWithFormat}`;
      }).join("\n\n");
      
      await fs.writeFile(promptsFile, promptContent);
      logger.info(`Prompts saved to ${promptsFile}`);
      
      const manualImagesDir = path.join(projectDir, "images");
      await fs.mkdir(manualImagesDir, { recursive: true });
      logger.warn(`👇 WHAT TO DO NEXT 👇`);
      logger.warn(`1. Generate your videos using the prompts in ${promptsFile}`);
      logger.warn(`2. Save the videos as scene_0.mp4, scene_1.mp4, etc. into the folder: ${manualImagesDir}`);
      logger.warn(`3. Once done, render the final video by running: npm run render ${projectId}`);
    } else {
      try {
        videoPath = await this.videoRenderer.renderVideo({
          projectId,
          script,
          audioPath,
          audioDurationMs: ttsResult.totalDurationMs,
          outputDir: videoDir,
          style,
          showSubtitles,
          format,
        });
      } catch (e: any) {
        logger.error(`Failed to render video for ${projectId}: ${e.message}`);
      }
    }

    // 5. Save project
    await db.insert(videoProjects).values({
      id: projectId,
      contentId: dbContentId,
      status: style === "manual" ? "pending_assets" : "draft",
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
      status: style === "manual" ? "pending_assets" : "draft",
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
    showSubtitles?: boolean;
    interactive?: boolean;
    format?: 'vertical' | 'horizontal';
  }): Promise<any[]> {
    logger.info("Running full pipeline...");

    // Scrape more items if interactive so the user has options
    const targetLimit = options?.limit || 5;
    const fetchLimit = options?.interactive ? Math.max(10, targetLimit * 2) : targetLimit;
    const scrapedContents = await this.scrape({ ...options, limit: fetchLimit });
    
    // Filter out already completed items
    let freshContents: ScrapedContent[] = [];
    for (const content of scrapedContents) {
      const existing = await db.select().from(scrapedContent).where(eq(scrapedContent.url, content.url));
      if (existing.length === 0 || !existing[0].isProjectComplete) {
        freshContents.push(content);
      }
    }
    
    if (freshContents.length === 0) {
      logger.info("No fresh content found to process.");
      return [];
    }

    let contentsToProcess = freshContents.slice(0, targetLimit);

    if (options?.interactive) {
      const choices = freshContents.map((content, idx) => ({
        name: `[${content.score} pts] ${content.title}`,
        value: content,
        checked: idx < targetLimit // Pre-check the first 'limit' items
      }));

      contentsToProcess = await checkbox({
        message: `Select which stories to turn into videos (limit: ${targetLimit}):`,
        choices: choices,
        loop: false,
      });

      if (contentsToProcess.length === 0) {
        logger.info("No stories selected. Exiting.");
        return [];
      }
    }

    const projects = [];

    for (const content of contentsToProcess) {
      try {
        const project = await this.processOne(content, options?.style, options?.showSubtitles, options?.format);
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

  async renderExisting(projectId: string, showSubtitles: boolean = false, style: VideoStyle = "gradient", format: 'vertical' | 'horizontal' = 'vertical'): Promise<string | null> {
    logger.info(`Rendering existing project: ${projectId}`);
    
    // Get project from DB
    const project = await db.select().from(videoProjects).where(eq(videoProjects.id, projectId)).get();
    if (!project) {
      logger.error(`Project ${projectId} not found in database.`);
      return null;
    }

    if (!project.audioPath) {
      logger.error(`Project ${projectId} does not have an audio file yet.`);
      return null;
    }

    const script = JSON.parse(project.scriptJson as string);
    const outputDir = path.resolve("output");
    const projectDir = path.join(outputDir, projectId);
    const videoDir = path.join(projectDir, "videos");
    await fs.mkdir(videoDir, { recursive: true });

    // Auto-fix videos so the user doesn't have to do it manually
    logger.info(`[Auto-Fix] Checking and converting video codecs for Remotion compatibility...`);
    try {
      const { stdout } = await execAsync(`npm run fix-videos ${projectId}`);
      if (stdout) logger.info(`[Auto-Fix Output]\n${stdout}`);
    } catch (e: any) {
      logger.warn(`[Auto-Fix] Issue while fixing videos (they might already be fixed): ${e.message}`);
    }

    let videoPath = "";
    try {
      if (style === "manual" && !showSubtitles) {
        logger.info(`[Pipeline] ⚡ Using Lightning-Fast FFmpeg Renderer since subtitles are OFF!`);
        const ffmpegRenderer = new FFmpegRenderer();
        videoPath = await ffmpegRenderer.renderVideo({
          projectId,
          script,
          audioPath: project.audioPath as string,
          audioDurationMs: 0,
          outputDir: videoDir,
          manualDir: path.join(projectDir, "images"),
          format,
        });
      } else {
        logger.info(`[Pipeline] 🎨 Using Remotion Renderer...`);
        videoPath = await this.videoRenderer.renderVideo({
          projectId,
          script,
          audioPath: project.audioPath as string,
          audioDurationMs: 0, // Fallback to word count calculation
          outputDir: videoDir,
          style,
          showSubtitles,
          format,
        });
      }
      
      await db.update(videoProjects)
        .set({ status: "draft", videoPath })
        .where(eq(videoProjects.id, projectId));
        
      logger.success(`Successfully rendered manual video: ${videoPath}`);
      return videoPath;
    } catch (e: any) {
      logger.error(`Failed to render video for ${projectId}: ${e.message}`);
      return null;
    }
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
