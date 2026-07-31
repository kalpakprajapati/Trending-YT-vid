# The Node Daily - Automated YouTube Content Pipeline

## 📖 Project Overview
This project is a fully automated, end-to-end content generation pipeline designed to create viral, 9:16 vertical short-form videos for the YouTube channel **"The Node Daily"**. 

It handles everything from sourcing breaking news to rendering the final MP4 video, drastically reducing human intervention.

## ✨ Core Features
- **Multi-Source Scraping**: Capable of pulling trending stories from Reddit or breaking news from global RSS feeds.
- **AI-Powered Scripting**: Uses Google's Gemini AI to rewrite dry news or Reddit posts into highly engaging, dramatic, click-optimized scripts with 3-second hooks and SEO metadata.
- **Automated Voiceover**: Generates natural-sounding text-to-speech narration using Microsoft Edge TTS.
- **Dynamic AI Image Generation**: Uses Pollinations AI (Flux model) to generate photorealistic, bright, cinematic 9:16 background images based on highly specific visual prompts written by the AI scriptwriter.
- **Programmatic Video Editing**: Uses Remotion to stitch audio, images, and text together into a final video. Features include Ken Burns zoom effects, crossfades, and dynamic karaoke-style subtitles.
- **Database State Management**: Uses SQLite and Drizzle ORM to track which articles have been scraped and which have been fully converted into videos, ensuring no duplicate content is ever produced.

## 🛠️ Technical Stack
- **Runtime & Language**: Node.js, TypeScript (ESM)
- **Database**: SQLite, Drizzle ORM
- **AI Models**: `@google/genai` (Gemini 2.5 Flash for scripting), Pollinations AI (Flux for images)
- **Video Rendering**: Remotion (`@remotion/cli`, `@remotion/renderer`)
- **Scraping**: `snoowrap` (Reddit), `rss-parser` (RSS feeds)
- **Audio**: `edge-tts` (via Python CLI spawned in Node)

## 📂 Pipeline Flow
1. **Scrape**: Fetches N articles from the chosen source and category. Filters out extremely short articles.
2. **Database Check**: Checks SQLite `scraped_content` to see if the article has been processed before. If yes, it skips.
3. **AI Scripting**: Gemini analyzes the article and outputs a strictly formatted JSON containing the title, description, tags, hook, and an array of scenes (narration text + visual image prompts).
4. **Voice Generation**: Concatenates the script and runs `edge-tts` to generate a master audio file.
5. **Visual Generation**: Loops through the script's scenes and pings Pollinations AI to generate a matching image for each scene.
6. **Video Composition**: Remotion calculates the exact duration of the audio, divides the images along the timeline, generates subtitles, and renders the final `video.mp4`.
7. **Mark Complete**: Updates the SQLite `is_project_complete` flag to true.

## 🚀 Handy Commands
You can run the pipeline automatically using the npm scripts configured in `package.json`:

```bash
# Pulls from TechCrunch, The Verge, Wired
npm run dev:tech 

# Pulls from BBC, NYT, Al Jazeera
npm run dev:world 

# Pulls exclusively Artificial Intelligence news
npm run dev:ai 

# Pulls from NASA, ScienceDaily
npm run dev:science 

# Run manually with limit and style flags
npm run dev -- run --source rss --category tech --style cinematic --limit 1
```

## 📁 Output Structure
When a video is generated, it creates an isolated folder inside `output/` using a unique slug.
```
output/
└── [project-slug]/
    ├── audio/              # Generated TTS .mp3
    ├── images/             # Pollinations AI generated scenes
    ├── scripts/            # Gemini AI JSON script
    ├── videos/             # Final Remotion .mp4
    └── youtube_metadata.txt # Titles, description, and tags for easy copy-pasting
```

## 🔮 Next Phase / Future Work
- **YouTube OAuth Integration**: Automate the actual uploading of the `.mp4` and metadata directly to the YouTube channel via the YouTube Data API v3.
- **Gameplay Backgrounds**: Add a third video style option (`--style gameplay`) to overlay split-screen GTA V or Minecraft parkour gameplay under the news footage.
