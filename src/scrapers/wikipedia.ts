import type { ContentProvider, FetchOptions, ScrapedContent } from './types.js';

/**
 * Wikipedia API Scraper (Stub for Future)
 * Will use the open MediaWiki API to fetch "On This Day" or random interesting pages.
 */
export class WikipediaScraper implements ContentProvider {
  readonly sourceName = 'wikipedia';

  async fetchContent(options: FetchOptions): Promise<ScrapedContent[]> {
    console.log(`[Wikipedia Scraper] This module is planned for a future update.`);
    // TODO: Implement Wikipedia Action API / REST API calls
    return [];
  }
}
