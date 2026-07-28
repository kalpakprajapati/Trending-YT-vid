# Trending YT Vid

A complete automated pipeline for scraping trending content, generating AI scripts, rendering voiceovers, and ultimately publishing shorts/videos to YouTube.

## Features
- **Scrape**: Pull trending posts from Reddit.
- **Generate Script**: Format the content into a video script using AI.
- **Voiceover**: Generate TTS audio using edge-tts.
- **Pipeline Orchestrator**: Run everything end-to-end with a single command.

## Prerequisites
- Node.js 18+
- Python (for `edge-tts`)
- FFmpeg (for audio/video manipulation)

## Setup
1. Clone the repository.
2. Run `npm install`.
3. Make sure to install `nanoid` v3 if not already present: `npm install nanoid@3`.
4. Copy `.env.example` to `.env` and fill in your keys (Reddit API, AI API keys).
5. Run commands using `npx tsx src/index.ts`.

## Usage

```bash
# Scrape trending content from specific subreddits
npx tsx src/index.ts scrape --subreddits "AskReddit,TrueOffMyChest" --limit 10

# Run the full pipeline
npx tsx src/index.ts run --limit 5

# List generated projects
npx tsx src/index.ts list
```

## Project Structure
- `src/scrapers/` - Content sources (Reddit)
- `src/ai/` - Script generation logic
- `src/voice/` - Text-to-speech module
- `src/db/` - Drizzle ORM and schema
- `src/upload/` - Upload logic (YouTube)
- `src/pipeline.ts` - Main orchestrator
- `src/index.ts` - CLI entry point

## Roadmap
- **Phase 1**: Scraping, Script Generation, Voiceover, Database setup
- **Phase 2**: Video Rendering, YouTube Uploading
- **Phase 3**: Analytics & Monitoring
- **Phase 4**: Full Automation (Cron jobs)
