import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { RedditScraper } from './scrapers/reddit.js';
import type { ScrapedContent } from './scrapers/types.js';
import { ScriptGenerator } from './ai/script-generator.js';
import type { GeneratedScript } from './ai/types.js';
import { VoiceGenerator } from './voice/tts.js';
import { db } from './db/client.js';
import { scraped_content, video_projects } from './db/schema.js';
import type { Config } from './config.js';
import { logger } from './utils/logger.js';

export class Pipeline {
  private scraper: RedditScraper;
  private scriptGen: ScriptGenerator;
  private voiceGen: VoiceGenerator;
  
  constructor(config: Config) {
    this.scraper = new RedditScraper(config);
    this.scriptGen = new ScriptGenerator(config);
    this.voiceGen = new VoiceGenerator(config);
  }
  
  // Run the full pipeline for one piece of content
  async processOne(content: ScrapedContent): Promise<any> {
    logger.info(`Processing single content: ${content.id}`);
    
    // 1. Check if it exists in DB
    const existing = await db.select().from(scraped_content).where(eq(scraped_content.source_id, content.id));
    
    let dbContentId = '';
    if (existing.length === 0) {
      dbContentId = nanoid();
      await db.insert(scraped_content).values({
        id: dbContentId,
        source_id: content.id,
        title: content.title,
        content: content.text,
        url: content.url,
        subreddit: content.subreddit,
        created_at: new Date()
      });
    } else {
      dbContentId = existing[0].id;
      logger.info(`Content ${content.id} already exists in DB, reusing.`);
    }

    const projectId = nanoid();
    
    // 2. Generate script
    logger.info(`Generating script for ${content.id}...`);
    const script = await this.scriptGen.generateScript(content);
    
    // Save script
    const scriptDir = path.join(process.cwd(), 'output', 'scripts');
    await fs.mkdir(scriptDir, { recursive: true });
    const scriptPath = path.join(scriptDir, `${projectId}.json`);
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));
    
    // 3. Generate voice
    logger.info(`Generating voice for ${projectId}...`);
    const audioPath = await this.voiceGen.generateForScript(script, projectId);
    
    // 4. Save project
    await db.insert(video_projects).values({
      id: projectId,
      scraped_content_id: dbContentId,
      status: 'draft',
      script_path: scriptPath,
      audio_path: audioPath,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    logger.success(`Successfully processed ${content.id} into project ${projectId}`);
    return {
      id: projectId,
      scraped_content_id: dbContentId,
      status: 'draft',
      script_path: scriptPath,
      audio_path: audioPath
    };
  }
  
  // Run the full pipeline: scrape -> filter -> generate scripts -> voice -> save
  async run(options?: { limit?: number, subreddits?: string[] }): Promise<any[]> {
    logger.info('Running full pipeline...');
    
    const contents = await this.scrape(options);
    const projects = [];
    
    for (const content of contents) {
      try {
        const project = await this.processOne(content);
        projects.push(project);
      } catch (error: any) {
        logger.error(`Error processing content ${content.id}: ${error.message}`);
      }
    }
    
    logger.success(`Pipeline finished. Processed ${projects.length} projects.`);
    return projects;
  }
  
  // Individual steps (can be run standalone)
  async scrape(options?: { subreddits?: string[], limit?: number }): Promise<ScrapedContent[]> {
    logger.info('Scraping content...');
    let contents: ScrapedContent[] = [];
    if (options?.subreddits && options.subreddits.length > 0) {
      contents = await this.scraper.scrapeMultiple(options.subreddits, options.limit || 5);
    } else {
      contents = await this.scraper.scrapeSubreddit('AskReddit', options?.limit || 5); // default
    }
    
    logger.info(`Scraped ${contents.length} items.`);
    return contents;
  }
  
  async generateScript(content: ScrapedContent): Promise<GeneratedScript> {
    return this.scriptGen.generateScript(content);
  }
  
  async generateVoice(script: GeneratedScript, projectId: string): Promise<string> {
    return this.voiceGen.generateForScript(script, projectId);
  }
}
