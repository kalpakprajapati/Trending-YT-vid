import type { ContentProvider, FetchOptions, ScrapedContent } from './types.js';

/**
 * Hacker News API Scraper
 * Uses the official open Firebase API (no authentication required).
 */
export class HackerNewsScraper implements ContentProvider {
  readonly sourceName = 'hackernews';
  private readonly baseUrl = 'https://hacker-news.firebaseio.com/v0';

  async fetchContent(options: FetchOptions): Promise<ScrapedContent[]> {
    console.log(`[HackerNews Scraper] Fetching top stories...`);
    try {
      // Fetch top story IDs
      const topStoriesRes = await fetch(`${this.baseUrl}/topstories.json`);
      if (!topStoriesRes.ok) throw new Error('Failed to fetch HN top stories');
      
      const storyIds: number[] = await topStoriesRes.json();
      const results: ScrapedContent[] = [];
      const minScore = options.minScore || 100;
      
      // We'll iterate through top stories until we hit the requested limit
      let processed = 0;
      for (const id of storyIds) {
        if (results.length >= options.limit) break;
        if (processed > 50) break; // safeguard to avoid hitting API infinitely
        processed++;

        const storyRes = await fetch(`${this.baseUrl}/item/${id}.json`);
        if (!storyRes.ok) continue;
        const story = await storyRes.json();

        // Skip non-stories or low score items
        if (!story || story.type !== 'story' || (story.score || 0) < minScore) {
          continue;
        }

        console.log(`[HackerNews Scraper] Fetching details and comments for story: ${id}`);
        
        // Fetch top comments (kids)
        const topComments: string[] = [];
        if (story.kids && story.kids.length > 0) {
          // fetch up to top 5 comments
          for (const kidId of story.kids.slice(0, 5)) {
            const commentRes = await fetch(`${this.baseUrl}/item/${kidId}.json`);
            if (commentRes.ok) {
              const comment = await commentRes.json();
              if (comment && comment.text && !comment.deleted) {
                // Strip basic HTML from HN comments
                const cleanText = comment.text.replace(/<[^>]*>?/gm, ' ');
                topComments.push(cleanText);
              }
            }
          }
        }

        // Delay to be polite to the API
        await new Promise(resolve => setTimeout(resolve, 500));

        results.push({
          id: story.id.toString(),
          source: 'hackernews',
          title: story.title,
          // HN text is optional (for Ask HN). If it's a link, we mention the URL as context.
          body: story.text ? story.text.replace(/<[^>]*>?/gm, ' ') : `External Link: ${story.url || 'None'}`,
          url: `https://news.ycombinator.com/item?id=${story.id}`,
          author: story.by,
          score: story.score,
          commentCount: story.descendants || 0,
          category: 'tech',
          topComments,
          scrapedAt: new Date()
        });
      }

      console.log(`[HackerNews Scraper] Successfully fetched ${results.length} stories.`);
      return results;
    } catch (error) {
      console.error('[HackerNews Scraper] Error fetching content:', error);
      return [];
    }
  }
}
