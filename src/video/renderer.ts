import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { logger } from '../utils/logger.js';
import { PollinationsImageGen } from '../images/pollinations.js';
import type { GeneratedScript } from '../ai/types.js';

export type VideoStyle = 'gradient' | 'cinematic';

interface RenderOptions {
  projectId: string;
  script: GeneratedScript;
  audioPath: string;
  audioDurationMs?: number;
  outputDir: string;
  style?: VideoStyle;
}

export class VideoRenderer {
  async renderVideo({ projectId, script, audioPath, audioDurationMs, outputDir, style = 'gradient' }: RenderOptions): Promise<string> {
    logger.info(`[Video Renderer] Style: ${style.toUpperCase()} | Project: ${projectId}`);

    const fps = 30;

    // Build scene list matching TTS audio order: hookLine -> scenes -> outro
    const parts: Array<{ text: string; spokenText: string; emotion: string }> = [];
    if (script.hookLine) {
      parts.push({ text: script.hookLine, spokenText: script.hookLine, emotion: 'dramatic' });
    }
    for (const scene of script.scenes) {
      parts.push({
        text: scene.onScreenText || scene.text,
        spokenText: scene.text,
        emotion: scene.emotion || 'neutral',
      });
    }
    if (script.outro) {
      parts.push({ text: script.outro, spokenText: script.outro, emotion: 'wholesome' });
    }

    // Calculate durations proportionally from actual audio duration
    const wordCounts = parts.map(p => p.spokenText.split(/\s+/).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);

    let totalDurationFrames: number;
    if (audioDurationMs && audioDurationMs > 0) {
      totalDurationFrames = Math.round((audioDurationMs / 1000) * fps);
      logger.info(`[Video Renderer] Audio duration: ${(audioDurationMs / 1000).toFixed(1)}s (${totalDurationFrames} frames)`);
    } else {
      totalDurationFrames = Math.round((totalWords / 3.0) * fps);
      logger.warn(`[Video Renderer] Estimating duration: ${(totalDurationFrames / fps).toFixed(1)}s`);
    }

    const allScenes = parts.map((part, i) => ({
      text: part.text,
      durationFrames: Math.max(Math.round((wordCounts[i] / totalWords) * totalDurationFrames), fps),
      emotion: part.emotion,
    }));

    // Fix rounding
    const computedTotal = allScenes.reduce((acc, s) => acc + s.durationFrames, 0);
    if (computedTotal !== totalDurationFrames && allScenes.length > 0) {
      allScenes[allScenes.length - 1].durationFrames += (totalDurationFrames - computedTotal);
    }

    // Temp public dir for Remotion to serve files
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-public-'));

    // Copy audio
    let audioFileName = '';
    if (audioPath && fs.existsSync(audioPath)) {
      audioFileName = `audio_${projectId}${path.extname(audioPath)}`;
      fs.copyFileSync(audioPath, path.join(publicDir, audioFileName));
      logger.info(`[Video Renderer] Audio copied to public dir`);
    }

    // ── Generate scene images if cinematic style ──
    let sceneImageNames: string[] = [];
    if (style === 'cinematic') {
      logger.info(`[Video Renderer] 🎨 Generating ${allScenes.length} AI background images via Pollinations...`);
      const imageGen = new PollinationsImageGen({ width: 1080, height: 1920 });
      const imageDir = path.join(os.tmpdir(), `remotion-images-${projectId}`);

      const imagePaths = await imageGen.generateForScenes(
        allScenes.map(s => ({ text: s.text, emotion: s.emotion })),
        imageDir,
        script.title
      );

      // Copy generated images to public dir
      for (let i = 0; i < imagePaths.length; i++) {
        if (imagePaths[i] && fs.existsSync(imagePaths[i])) {
          const imgName = `scene_${i}.jpg`;
          fs.copyFileSync(imagePaths[i], path.join(publicDir, imgName));
          sceneImageNames.push(imgName);
        } else {
          sceneImageNames.push('');
        }
      }

      // Cleanup temp image dir
      fs.rmSync(imageDir, { recursive: true, force: true });
      logger.info(`[Video Renderer] ✅ ${sceneImageNames.filter(Boolean).length}/${allScenes.length} images generated`);
    }

    // Log scene breakdown
    logger.info(`[Video Renderer] Scene breakdown:`);
    allScenes.forEach((s, i) => {
      const hasImg = sceneImageNames[i] ? '🖼️' : '🌀';
      logger.info(`  ${hasImg} Scene ${i + 1}: ${(s.durationFrames / fps).toFixed(1)}s - "${s.text.substring(0, 50)}..."`);
    });

    const inputProps = {
      title: script.title,
      scenes: allScenes,
      audioPath: audioFileName,
      sceneImages: sceneImageNames,
      style,
    };

    const bundleLocation = await bundle({
      entryPoint: path.resolve(process.cwd(), 'src/video/remotion/index.ts'),
      webpackOverride: (config) => config,
      publicDir,
    });

    logger.info(`[Video Renderer] Bundle created`);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'StoryVideo',
      inputProps,
    });

    const outputPath = path.join(outputDir, `${projectId}.mp4`);
    logger.info(`[Video Renderer] Rendering ${(totalDurationFrames / fps).toFixed(1)}s to ${outputPath}...`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      imageFormat: 'jpeg',
    });

    fs.rmSync(publicDir, { recursive: true, force: true });
    logger.success(`[Video Renderer] ✅ Video saved: ${outputPath}`);
    return outputPath;
  }
}
