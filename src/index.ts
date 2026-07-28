import { Pipeline } from './pipeline.js';
// Assume config is exported as default or named. We'll try a default/named pattern depending on how it's structured.
// If it fails to compile later, we can adapt, but let's assume it's named export.
import { config } from './config.js'; 
import { logger } from './utils/logger.js';
import { db } from './db/client.js';
import { video_projects } from './db/schema.js';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  // Parse simple options
  let limit = 5;
  let subreddits: string[] | undefined;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i+1]) {
      limit = parseInt(args[i+1], 10);
      i++;
    } else if (args[i] === '--subreddits' && args[i+1]) {
      subreddits = args[i+1].split(',').map(s => s.trim());
      i++;
    }
  }
  
  const pipeline = new Pipeline(config);
  
  try {
    switch (command) {
      case 'scrape':
        logger.info(chalk.blue('Starting scrape command...'));
        await pipeline.scrape({ limit, subreddits });
        break;
      case 'generate-script':
        logger.warn(chalk.yellow('Standalone generate-script requires content input, which is best done via code or the full run command.'));
        break;
      case 'generate-voice':
        logger.warn(chalk.yellow('Standalone generate-voice requires script input, which is best done via code or the full run command.'));
        break;
      case 'run':
        logger.info(chalk.blue('Starting full pipeline run...'));
        await pipeline.run({ limit, subreddits });
        break;
      case 'list':
        logger.info(chalk.blue('Listing all projects...'));
        const projects = await db.select().from(video_projects);
        console.table(projects.map(p => ({
          ID: p.id,
          Status: p.status,
          Created: p.created_at
        })));
        break;
      case 'help':
      default:
        console.log(`
Usage: tsx src/index.ts <command> [options]

Commands:
  scrape              Scrape trending content from Reddit
  generate-script     Generate scripts for scraped content
  generate-voice      Generate voiceover for scripts
  run                 Run full pipeline (scrape -> script -> voice)
  list                List all video projects and their status

Options:
  --limit <n>         Max items to process (default: 5)
  --subreddits <s>    Comma-separated subreddit list
        `);
        break;
    }
  } catch (error: any) {
    logger.error(chalk.red(`Command failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
