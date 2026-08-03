import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { logger } from '../utils/logger.js';
import { PollinationsImageGen } from '../images/pollinations.js';
import { GoogleFlowVideoGen } from '../images/google-flow.js';
import type { GeneratedScript } from '../ai/types.js';

export type VideoStyle = 'gradient' | 'cinematic' | 'flow' | 'manual';

interface RenderOptions {
  projectId: string;
  script: GeneratedScript;
  audioPath: string;
  audioDurationMs?: number;
  outputDir: string;
  style?: VideoStyle;
  showSubtitles?: boolean;
  format?: 'vertical' | 'horizontal';
}

export class VideoRenderer {
  async renderVideo({ projectId, script, audioPath, audioDurationMs, outputDir, style = 'gradient', showSubtitles = false, format = 'vertical' }: RenderOptions): Promise<string> {
    logger.info(`[Video Renderer] Style: ${style.toUpperCase()} | Subtitles: ${showSubtitles} | Format: ${format} | Project: ${projectId}`);

    const fps = 30;

    // Build scene list matching TTS audio order: hookLine -> scenes -> outro
    const parts: Array<{ text: string; spokenText: string; emotion: string; imagePrompt?: string }> = [];
    if (script.hookLine) {
      parts.push({ text: script.hookLine, spokenText: script.hookLine, emotion: 'dramatic', imagePrompt: script.scenes[0]?.imagePrompt });
    }
    for (const scene of script.scenes) {
      parts.push({
        text: scene.onScreenText || scene.text,
        spokenText: scene.text,
        emotion: scene.emotion || 'neutral',
        imagePrompt: scene.imagePrompt
      });
    }
    if (script.outro) {
      parts.push({ text: script.outro, spokenText: script.outro, emotion: 'wholesome', imagePrompt: script.scenes[script.scenes.length - 1]?.imagePrompt });
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
      imagePrompt: part.imagePrompt,
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

    // ── Generate scene assets if cinematic or flow style ──
    let sceneImageNames: string[] = [];
    if (style === 'cinematic' || style === 'flow') {
      logger.info(`[Video Renderer] 🎨 Generating ${allScenes.length} AI background assets...`);
      const imageDir = path.join(os.tmpdir(), `remotion-assets-${projectId}`);
      let imagePaths: string[] = [];

      if (style === 'flow') {
        const flowGen = new GoogleFlowVideoGen();
        imagePaths = await flowGen.generateForScenes(allScenes, imageDir, script.title);
      } else {
        const isHorizontal = format === 'horizontal';
        const imageGen = new PollinationsImageGen({ 
          width: isHorizontal ? 1920 : 1080, 
          height: isHorizontal ? 1080 : 1920 
        });
        imagePaths = await imageGen.generateForScenes(allScenes, imageDir, script.title);
      }

      // Copy generated images/videos to public dir
      for (let i = 0; i < imagePaths.length; i++) {
        if (imagePaths[i] && fs.existsSync(imagePaths[i])) {
          const ext = path.extname(imagePaths[i]);
          const imgName = `scene_${i}${ext}`;
          fs.copyFileSync(imagePaths[i], path.join(publicDir, imgName));
          sceneImageNames.push(imgName);
        } else {
          sceneImageNames.push('');
        }
      }

      // Cleanup temp dir
      fs.rmSync(imageDir, { recursive: true, force: true });
      logger.info(`[Video Renderer] ✅ ${sceneImageNames.filter(Boolean).length}/${allScenes.length} assets generated`);
    } else if (style === 'manual') {
      logger.info(`[Video Renderer] 🎨 Loading manual background assets...`);
      // When manual, pipeline stops and asks user to put images/videos in output/[projectId]/images/
      // outputDir is output/[projectId]/videos, so we go up one dir
      const manualDir = path.join(outputDir, '..', 'images');
      if (!fs.existsSync(manualDir)) fs.mkdirSync(manualDir, { recursive: true });

      for (let i = 0; i < allScenes.length; i++) {
        const mp4Path = path.join(manualDir, `scene_${i}.mp4`);
        const jpgPath = path.join(manualDir, `scene_${i}.jpg`);
        if (fs.existsSync(mp4Path)) {
          const imgName = `scene_${i}.mp4`;
          fs.copyFileSync(mp4Path, path.join(publicDir, imgName));
          sceneImageNames.push(imgName);
        } else if (fs.existsSync(jpgPath)) {
          const imgName = `scene_${i}.jpg`;
          fs.copyFileSync(jpgPath, path.join(publicDir, imgName));
          sceneImageNames.push(imgName);
        } else {
          logger.warn(`[Video Renderer] ⚠️ Missing manual asset for scene ${i}. Expected scene_${i}.mp4 or scene_${i}.jpg`);
          sceneImageNames.push('');
        }
      }
      logger.info(`[Video Renderer] ✅ ${sceneImageNames.filter(Boolean).length}/${allScenes.length} assets loaded`);
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
      showSubtitles,
      format,
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
