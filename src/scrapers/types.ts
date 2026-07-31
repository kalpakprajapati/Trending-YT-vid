export interface FetchOptions {
  limit: number;
  category?: string; // Generic category: e.g. subreddit for reddit, or topic for wikipedia
  minScore?: number;
  minWordCount?: number;
}

export interface ScrapedContent {
  id: string;
  source: 'reddit' | 'hackernews' | 'wikipedia' | 'ai' | 'youtube' | 'tiktok';
  title: string;
  body: string;
  url: string;
  author?: string;
  score?: number;
  commentCount?: number;
  category?: string; // maps to subreddit, topic, etc.
  topComments: string[]; // context
  scrapedAt: Date;
}

export interface ContentProvider {
  /**
   * Identifies the source of the content
   */
  readonly sourceName: string;
  
  /**
   * Fetches content based on the provided options
   */
  fetchContent(options: FetchOptions): Promise<ScrapedContent[]>;
}
