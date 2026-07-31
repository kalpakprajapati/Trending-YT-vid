import type { ContentProvider, FetchOptions, ScrapedContent } from './types.js';

/**
 * Pure AI Content Generator (Stub for Future)
 * Instead of scraping, this will prompt Gemini to generate content directly
 * (e.g., riddles, psychological facts, "would you rather").
 */
export class PureAiScraper implements ContentProvider {
  readonly sourceName = 'ai';

  async fetchContent(options: FetchOptions): Promise<ScrapedContent[]> {
    console.log(`[Pure AI Scraper] This module is planned for a future update.`);
    // TODO: Connect directly to Gemini to generate synthetic content
    return [];
  }
}
