import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');
const dataDir = join(rootDir, 'data');

// Auto-create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'trending-yt.db');

/**
 * SQLite database connection using libSQL
 */
const client = createClient({ url: `file:${dbPath}` });

/**
 * Drizzle ORM instance
 */
export const db = drizzle(client, { schema });
