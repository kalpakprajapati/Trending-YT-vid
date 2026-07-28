import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Schema for scraped content.
 */
export const scrapedContent = sqliteTable('scraped_content', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  url: text('url').notNull(),
  score: integer('score').notNull(),
  commentCount: integer('comment_count').notNull(),
  subreddit: text('subreddit'),
  scrapedAt: text('scraped_at').notNull(),
  usedAt: text('used_at'),
});

/**
 * Schema for video projects.
 */
export const videoProjects = sqliteTable('video_projects', {
  id: text('id').primaryKey(),
  contentId: text('content_id').references(() => scrapedContent.id).notNull(),
  scriptJson: text('script_json').notNull(),
  audioPath: text('audio_path'),
  videoPath: text('video_path'),
  thumbnailPath: text('thumbnail_path'),
  status: text('status').notNull(), // draft/review/approved/uploaded
  youtubeId: text('youtube_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  tags: text('tags').notNull(), // JSON array
  createdAt: text('created_at').notNull(),
  publishedAt: text('published_at'),
});
