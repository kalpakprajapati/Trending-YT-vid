import { Pipeline } from './pipeline.js';
import type { VideoStyle } from './video/renderer.js';
// If it fails to compile later, we can adapt, but let's assume it's named export.
import { config } from './config.js'; 
import { logger } from './utils/logger.js';
import { db } from './db/client.js';
import { videoProjects } from './db/schema.js';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  // Parse simple options
  let limit = 5;
  let source = 'hackernews'; // Default source
  let category: string | undefined;
  let style: VideoStyle = 'gradient';
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i+1]) {
      limit = parseInt(args[i+1], 10);
      i++;
    } else if (args[i] === '--source' && args[i+1]) {
      source = args[i+1];
      i++;
    } else if (args[i] === '--category' && args[i+1]) {
      category = args[i+1];
      i++;
    } else if (args[i] === '--style' && args[i+1]) {
      style = args[i+1] as VideoStyle;
      i++;
    }
  }
  
  const pipeline = new Pipeline(config);
  
  try {
    switch (command) {
      case 'scrape':
        logger.info(chalk.blue('Starting scrape command...'));
        await pipeline.scrape({ source, limit, category });
        break;
      case 'generate-script':
        logger.warn(chalk.yellow('Standalone generate-script requires content input, which is best done via code or the full run command.'));
        break;
      case 'generate-voice':
        logger.warn(chalk.yellow('Standalone generate-voice requires script input, which is best done via code or the full run command.'));
        break;
      case 'run':
        logger.info(chalk.blue('Running full automated pipeline...'));
        logger.info(chalk.magenta(`Video style: ${style}`));
        await pipeline.run({ source, limit, category, style });
        break;
      case 'list':
        logger.info(chalk.blue('Listing all projects...'));
        const projects = await db.select().from(videoProjects);
        console.table(projects.map(p => ({
          ID: p.id,
          Status: p.status,
          Created: p.createdAt
        })));
        break;
      case 'help':
      default:
        console.log(`
Usage: tsx src/index.ts <command> [options]

Commands:
  scrape              Scrape trending content
  run                 Run full pipeline (scrape -> script -> voice -> video)
  list                List all video projects and their status

Options:
  --limit <n>         Max items to process (default: 5)
  --source <s>        Content source: hackernews, reddit (default: hackernews)
  --style <s>         Video style: gradient (animated bg) or cinematic (AI images) (default: gradient)
  --category <s>      Content category filter

Examples:
  npm run dev -- run --limit 1                          # Gradient style
  npm run dev -- run --limit 1 --style cinematic        # AI image backgrounds
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
