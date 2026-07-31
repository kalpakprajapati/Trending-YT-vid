import Parser from 'rss-parser';
import { nanoid } from 'nanoid';
import { ScrapedContent } from './types.js'; // Assuming types.js exports ScrapedContent interface

const FEEDS: Record<string, string[]> = {
  tech: [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://www.wired.com/feed/rss',
  ],
  world: [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
  ],
  science: [
    'https://www.sciencedaily.com/rss/top/science.xml',
    'https://www.nasa.gov/rss/dyn/breaking_news.rss',
  ],
  ai: [
    'https://artificialintelligence-news.com/feed/',
  ],
};

export class RssScraper {
  readonly sourceName: string = 'rss';
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  async fetchContent(options: { limit?: number; category?: string }): Promise<ScrapedContent[]> {
    const category = options.category && FEEDS[options.category] ? options.category : 'tech';
    const feedUrls = FEEDS[category];
    const limit = options.limit || 5;
    
    let allArticles: ScrapedContent[] = [];

    console.log(`[RSS Scraper] Fetching ${category} news...`);

    for (const url of feedUrls) {
      try {
        const feed = await this.parser.parseURL(url);
        
        for (const item of feed.items) {
          // Combine content/summary
          let body = item.contentSnippet || item.content || item.summary || '';
          
          // Basic clean up of HTML tags if any remain
          body = body.replace(/<[^>]*>?/gm, '').trim();

          // Skip extremely short articles which won't make good videos
          if (body.length < 50) continue;

          allArticles.push({
            id: nanoid(),
            source: 'rss',
            title: item.title || 'Untitled',
            body: body,
            url: item.link || url,
            score: 100,
            commentCount: 0,
            subreddit: category,
            topComments: [],
            author: item.creator || 'RSS',
            scrapedAt: new Date().toISOString(),
          } as any);
        }
      } catch (err: any) {
        console.error(`[RSS Scraper] Failed to fetch feed ${url}: ${err.message}`);
      }
    }

    // Sort by newest first? RSS parser doesn't always guarantee order across feeds,
    // but typically items are chronological. We will just shuffle or take top 'limit'.
    // Taking the top N
    return allArticles.slice(0, limit);
  }
}
