export interface ScraperOptions {
  subreddit: string;
  limit: number;
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  minScore: number;
  minWordCount: number; // for text posts
}

export interface ScrapedContent {
  id: string;
  source: 'reddit' | 'youtube' | 'tiktok';
  title: string;
  body: string;
  url: string;
  author: string;
  score: number;
  commentCount: number;
  subreddit?: string;
  topComments: string[]; // top 5 comments for context
  scrapedAt: Date;
}
