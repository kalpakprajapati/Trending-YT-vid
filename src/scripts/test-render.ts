import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import fs from 'fs/promises';
import { VoiceGenerator } from '../voice/tts.js';
import { VideoRenderer } from '../video/renderer.js';
import type { GeneratedScript } from '../ai/types.js';
import { nanoid } from 'nanoid';

async function main() {
  console.log("🎬 Starting Premium Video Generation Test...\n");

  // A realistic AI-generated script with varied emotions
  const mockScript: GeneratedScript = {
    title: "My Boss Fired Me... Then Begged Me to Come Back 3 Days Later",
    description: "An incredible story of workplace revenge",
    tags: ["reddit", "stories", "revenge", "workplace"],
    hookLine: "What happens when your boss fires you, only to realize you were the only one keeping the company alive?",
    outro: "If you enjoyed this story, smash that like button and subscribe for more!",
    estimatedDurationSec: 45,
    scenes: [
      {
        text: "So I worked at this small tech company for five years. I was the lead developer and basically built their entire platform from scratch.",
        emotion: "neutral" as const,
        pauseAfterMs: 300,
      },
      {
        text: "One Monday morning, my boss calls me into his office and says, 'We're letting you go. We found someone cheaper overseas.'",
        emotion: "dramatic" as const,
        pauseAfterMs: 500,
      },
      {
        text: "I couldn't believe it. Five years of loyalty, gone in thirty seconds. I packed my desk and left without saying a word.",
        emotion: "suspenseful" as const,
        pauseAfterMs: 400,
      },
      {
        text: "Three days later, their entire production server crashes. Turns out I was the only one who knew the deployment passwords.",
        emotion: "funny" as const,
        pauseAfterMs: 500,
      },
      {
        text: "My old boss called me seventeen times that day. When I finally picked up, he offered me double my salary to come back.",
        emotion: "wholesome" as const,
        pauseAfterMs: 300,
      },
    ]
  };

  const projectId = `test_${nanoid(8)}`;

  const outputAudioDir = path.join(process.cwd(), 'output', 'audio');
  const outputVideoDir = path.join(process.cwd(), 'output', 'videos');
  await fs.mkdir(outputAudioDir, { recursive: true });
  await fs.mkdir(outputVideoDir, { recursive: true });

  // 1. Generate the voiceover (Gemini TTS → edge-tts fallback)
  let audioPath = '';
  let audioDurationMs = 0;
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const voiceGen = new VoiceGenerator({ geminiApiKey });
    const ttsResult = await voiceGen.generateForScript(mockScript, outputAudioDir, projectId);
    audioPath = ttsResult.audioPath;
    audioDurationMs = ttsResult.totalDurationMs;
    console.log(`✅ Audio saved to: ${audioPath} (${(audioDurationMs / 1000).toFixed(1)}s, provider: ${ttsResult.provider})\n`);
  } catch (err: any) {
    console.warn(`⚠️ Audio generation failed: ${err.message}`);
    console.warn(`Rendering silent video instead.\n`);
  }

  // Parse --style flag from CLI args
  const args = process.argv.slice(2);
  const styleIdx = args.indexOf('--style');
  const style = (styleIdx !== -1 && args[styleIdx + 1]) ? args[styleIdx + 1] as 'gradient' | 'cinematic' : 'gradient';

  // 2. Render the final MP4 with Remotion
  console.log(`🎞️ Rendering ${style.toUpperCase()} MP4 Video with Remotion...`);
  if (style === 'cinematic') {
    console.log("   Features: AI-generated backgrounds, Ken Burns effect, karaoke subtitles\n");
  } else {
    console.log("   Features: Animated gradient background, karaoke subtitles, emoji reactions\n");
  }

  const renderer = new VideoRenderer();
  const videoPath = await renderer.renderVideo({
    projectId,
    script: mockScript,
    audioPath,
    audioDurationMs,
    outputDir: outputVideoDir,
    style,
  });

  console.log(`\n🎉 SUCCESS! Your premium video is ready:`);
  console.log(`   📁 ${videoPath}`);
  console.log(`\n   Open it in your media player and enjoy! 🍿`);
}

main().catch(console.error);
