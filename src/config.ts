import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Zod schema for environment variables validation.
 */
const envSchema = z.object({
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().url().optional(),
  POLLINATION_API_KEY: z.string().optional(),
  GEMINI_VOIDE_MODEL: z.string().optional(),
  GEMINI_VOICE_NAME: z.string().optional()
});

/**
 * Parsed and validated configuration object.
 */
export const config = envSchema.parse(process.env);

/**
 * Type of the validated environment variables.
 */
export type Config = z.infer<typeof envSchema>;
