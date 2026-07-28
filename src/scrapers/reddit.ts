import Snoowrap from 'snoowrap';
import { ScraperOptions, ScrapedContent } from './types.js';

export const DEFAULT_SUBREDDITS = [
  'AmItheAsshole',
  'tifu',
  'MaliciousCompliance',
  'ProRevenge',
  'entitledparents',
  'relationship_advice',
  'askreddit'
];

/**
 * Reddit Scraper class for fetching top posts and comments from subreddits
 */
export class RedditScraper {
  private client: Snoowrap;

  /**
   * Initializes the Reddit Scraper
   * @param credentials Reddit API credentials
   */
  constructor(credentials: Snoowrap.SnoowrapOptions) {
    this.client = new Snoowrap(credentials);
    // Configure delay to handle rate limiting gracefully
    this.client.config({ requestDelay: 1500, warnings: false });
  }

  /**
   * Scrapes top posts from a given subreddit
   * @param options Scraper options including subreddit, limit, etc.
   * @returns Array of scraped content
   */
  async scrapeSubreddit(options: ScraperOptions): Promise<ScrapedContent[]> {
    console.log(`[Reddit Scraper] Scraping subreddit: r/${options.subreddit}...`);
    try {
      const topPosts = await this.client
        .getSubreddit(options.subreddit)
        .getTop({ time: options.timeFilter, limit: options.limit });

      const results: ScrapedContent[] = [];

      for (const post of topPosts) {
        if (post.score < options.minScore) {
          continue;
        }

        const body = post.selftext || '';
        const wordCount = body.split(/\s+/).filter(Boolean).length;

        if (body && wordCount < options.minWordCount) {
          continue;
        }

        console.log(`[Reddit Scraper] Fetching comments for post: ${post.id}`);
        // Fetch full post to get comments
        const expandedPost = await post.fetch();
        
        // Assert type as snoowrap types for comments can be limited
        const comments = expandedPost.comments as any;
        
        const topComments = comments
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5)
          .map((c: any) => c.body || '')
          .filter((bodyText: string) => bodyText.trim().length > 0);

        results.push({
          id: post.id,
          source: 'reddit',
          title: post.title,
          body,
          url: post.url,
          author: post.author.name,
          score: post.score,
          commentCount: post.num_comments,
          subreddit: post.subreddit.display_name,
          topComments,
          scrapedAt: new Date(),
        });
      }

      console.log(`[Reddit Scraper] Successfully scraped ${results.length} posts from r/${options.subreddit}`);
      return results;
    } catch (error) {
      console.error(`[Reddit Scraper] Error scraping subreddit r/${options.subreddit}:`, error);
      return [];
    }
  }

  /**
   * Scrapes multiple subreddits and combines results
   * @param subreddits Array of subreddit names to scrape
   * @param options Scraper options omitting subreddit
   * @returns Array of combined and sorted scraped content
   */
  async scrapeMultiple(
    subreddits: string[],
    options: Omit<ScraperOptions, 'subreddit'>
  ): Promise<ScrapedContent[]> {
    console.log(`[Reddit Scraper] Scraping multiple subreddits: ${subreddits.join(', ')}`);
    const allResults: ScrapedContent[] = [];

    for (const subreddit of subreddits) {
      const results = await this.scrapeSubreddit({ ...options, subreddit });
      allResults.push(...results);
      
      // Additional delay between subreddits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Sort by score descending
    return allResults.sort((a, b) => b.score - a.score);
  }
}
