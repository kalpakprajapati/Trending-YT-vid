# The Node Daily - Automated YouTube Content Pipeline

## 📖 Project Overview
This project is an end-to-end content generation pipeline designed to create viral, 9:16 vertical short-form videos for the YouTube channel **"The Node Daily"**. 

It handles everything from sourcing breaking news to rendering the final MP4 video, drastically reducing human intervention. It supports both fully automated AI image generation and a semi-automated "manual" mode for incorporating high-quality external video assets (like Google Labs Flow).

## ✨ Core Features
- **Multi-Source Scraping**: Capable of pulling trending stories from Reddit or breaking news from global RSS feeds.
- **AI-Powered Scripting**: Uses Google's Gemini AI to rewrite dry news or Reddit posts into highly engaging, dramatic, click-optimized scripts with 3-second hooks and SEO metadata. 
- **Unique Visual Prompts**: Gemini outputs specialized, highly-detailed cinematic visual prompts for every single scene (including unique prompts specifically for the hook and outro).
- **Automated Voiceover**: Generates natural-sounding text-to-speech narration using Microsoft Edge TTS.
- **Dynamic AI Image Generation (`--style cinematic`)**: Uses Pollinations AI (Flux model) to generate photorealistic, bright, cinematic 9:16 background images based on the script's visual prompts.
- **Manual Video Mode (`--style manual`)**: Seamlessly handles external video clips. Automatically generates a prompt list with mathematically estimated scene durations, allowing human editors to generate external videos (e.g., via Google Flow) and drop them into the pipeline.
- **Lightning-Fast FFmpeg Engine**: When rendering manual videos without subtitles, the pipeline completely bypasses Chromium/Remotion and uses a custom raw FFmpeg engine. It mathematically loops, trims, and stitches clips to match voiceover timing flawlessly in seconds.
- **Auto-Fix Codec Script**: Automatically intercepts externally generated videos (which often have Chromium-breaking codecs like H.265/HEVC) and transcodes them to standard `yuv420p` H.264 behind the scenes.
- **Database State Management**: Uses SQLite and Drizzle ORM to track which articles have been scraped and processed.

## 🛠️ Technical Stack
- **Runtime & Language**: Node.js, TypeScript (ESM)
- **Database**: SQLite, Drizzle ORM
- **AI Models**: `@google/genai` (Gemini 2.5 Flash for scripting), Pollinations AI (Flux for images)
- **Video Processing**: `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg` (for fast manual rendering and codec fixing)
- **Visual Composition**: Remotion (for automated image Ken Burns effects and subtitle rendering)
- **Scraping**: `snoowrap` (Reddit), `rss-parser` (RSS feeds)
- **Audio**: `edge-tts` (via Python CLI spawned in Node)

## 📂 Pipeline Flow (Automated Mode)
1. **Scrape**: Fetches N articles from the chosen source/category.
2. **AI Scripting**: Gemini analyzes the article and outputs a JSON script (title, description, tags, hook, scenes, outro).
3. **Voice Generation**: Concatenates the script and runs `edge-tts`.
4. **Visual Generation**: Loops through the script's scenes and pings Pollinations AI to generate images.
5. **Video Composition**: Remotion calculates the exact duration of the audio, applies Ken Burns effects to images, generates subtitles (if enabled), and renders the `video.mp4`.

## 📂 Pipeline Flow (Manual Video Mode)
1. Run pipeline with `--style manual`. It scrapes, scripts, and generates voice, but *stops* before visuals.
2. It outputs a `google_flow_prompts.txt` file containing the AI prompts and exact estimated durations for each scene.
3. The user generates the videos externally, names them `scene_0.mp4`, `scene_1.mp4`, etc., and places them in the project's `images/` directory.
4. Run `npm run render <project_id>`.
5. The pipeline automatically runs `npm run fix-videos` to sanitize the video codecs.
6. The lightning-fast FFmpeg engine resizes, loops, trims, and stitches the videos to match the voiceover flawlessly in seconds.

## 🚀 Handy Commands

```bash
# Automated RSS Generation
npm run dev:tech 
npm run dev:world 
npm run dev:ai 
npm run dev:science 

# Run manually with limit and style flags
npm run dev -- run --source rss --category tech --style manual --limit 1

# Render a manual project after placing videos in the folder
npm run render <project-id>

# (Optional) Manually fix broken video codecs for a project
npm run fix-videos <project-id>
```

## 🔮 Next Phase / Future Work
- **YouTube OAuth Integration**: Automate the actual uploading of the `.mp4` and metadata directly to the YouTube channel via the YouTube Data API v3.
- **Gameplay Backgrounds**: Add a third video style option (`--style gameplay`) to overlay split-screen GTA V or Minecraft parkour gameplay under the news footage.
