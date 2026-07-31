import { FetchOptions, ScrapedContent, ContentProvider } from './types.js';

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
 * using unauthenticated JSON endpoints to bypass API restrictions.
 */
export class RedditScraper implements ContentProvider {
  readonly sourceName = 'reddit';
  
  /**
   * Initializes the Reddit Scraper
   * @param credentials Ignored (using unauthenticated endpoints)
   */
  constructor(credentials?: any) {
    // No credentials needed for the .json method
  }

  async fetchContent(options: FetchOptions): Promise<ScrapedContent[]> {
    const subreddits = options.category ? [options.category] : ['AskReddit'];
    const limit = options.limit || 5;
    
    return this.scrapeMultiple(subreddits, {
      limit,
      minScore: options.minScore || 100,
      minWordCount: options.minWordCount || 50
    });
  }

  /**
   * Scrapes top posts from a given subreddit
   */
  private async scrapeSubreddit(options: any & { subreddit: string }): Promise<ScrapedContent[]> {
    console.log(`[Reddit Scraper] Scraping subreddit: r/${options.subreddit}...`);
    try {
      const url = `https://www.reddit.com/r/${options.subreddit}/top.json?t=day&limit=${options.limit}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'trending-yt-vid/1.0 (local desktop tool)' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const topPosts = data.data.children.map((child: any) => child.data);

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
        
        // Fetch comments for the post
        const commentsUrl = `https://www.reddit.com/r/${options.subreddit}/comments/${post.id}.json?sort=top`;
        const commentsResponse = await fetch(commentsUrl, {
          headers: { 'User-Agent': 'trending-yt-vid/1.0 (local desktop tool)' }
        });
        
        let topComments: string[] = [];
        if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            // The second element in the array contains the comments
            const commentsList = commentsData[1]?.data?.children || [];
            
            topComments = commentsList
              .map((c: any) => c.data?.body || '')
              .filter((bodyText: string) => bodyText.trim().length > 0)
              .slice(0, 5);
        }
        
        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));

        results.push({
          id: post.id,
          source: 'reddit',
          title: post.title,
          body,
          url: `https://www.reddit.com${post.permalink}`,
          author: post.author,
          score: post.score,
          commentCount: post.num_comments,
          category: post.subreddit,
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
   */
  private async scrapeMultiple(
    subreddits: string[],
    options: Omit<FetchOptions, 'category'>
  ): Promise<ScrapedContent[]> {
    console.log(`[Reddit Scraper] Scraping multiple subreddits: ${subreddits.join(', ')}`);
    const allResults: ScrapedContent[] = [];

    for (const subreddit of subreddits) {
      const results = await this.scrapeSubreddit({ ...options, subreddit });
      allResults.push(...results);
      
      // Additional delay between subreddits
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Sort by score descending
    return allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}
