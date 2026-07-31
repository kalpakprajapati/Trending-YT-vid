import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
import { logger } from '../utils/logger.js';
import type { GeneratedScript } from '../ai/types.js';

export class FFmpegRenderer {
  async renderVideo(options: {
    projectId: string;
    script: GeneratedScript;
    audioPath: string;
    audioDurationMs: number;
    outputDir: string;
    manualDir: string;
  }): Promise<string> {
    const { projectId, script, audioPath, audioDurationMs, outputDir, manualDir } = options;
    const finalVideoPath = path.join(outputDir, `${projectId}.mp4`);
    
    // Calculate durations
    const parts = [];
    if (script.hookLine) parts.push({ text: script.hookLine });
    script.scenes.forEach(s => parts.push({ text: s.text }));
    if (script.outro) parts.push({ text: script.outro });

    const wordCounts = parts.map(p => p.text.split(/\s+/).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);

    // edge-tts duration is in ms. If it's 0 (fallback), calculate it.
    let totalDurMs = audioDurationMs;
    if (!totalDurMs) {
       totalDurMs = (totalWords / 2.5) * 1000;
    }

    const sceneDurations = wordCounts.map(wc => (wc / totalWords) * (totalDurMs / 1000));

    logger.info(`[FFmpeg] 🎬 Resizing and looping ${parts.length} clips to match voiceover...`);

    const sizedClips: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const srcPath = path.join(manualDir, `scene_${i}.mp4`);
      const sizedPath = path.join(manualDir, `scene_${i}_sized.mp4`);
      
      const exists = await this.fileExists(srcPath);
      const durationSec = sceneDurations[i].toFixed(2);

      await new Promise((resolve, reject) => {
        let command = exists ? ffmpeg(srcPath) : ffmpeg('color=c=black:s=1080x1920:r=30');
        
        if (exists) {
          command = command.inputOptions(['-stream_loop', '-1']);
        } else {
          logger.warn(`[FFmpeg] Missing ${srcPath}, using black screen fallback.`);
          command = command.inputFormat('lavfi');
        }

        command
          .outputOptions([
            `-t ${durationSec}`, // Trim to exact duration
            '-c:v libx264',
            '-preset veryfast', // Super fast encoding
            '-crf 23',
            '-pix_fmt yuv420p',
            // Ensure resolution matches Shorts (1080x1920) and crop/scale
            '-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920'
          ])
          .save(sizedPath)
          .on('end', () => resolve(sizedPath))
          .on('error', (err) => {
            logger.error(`Error resizing scene ${i}: ${err.message}`);
            reject(err);
          });
      });
      
      sizedClips.push(sizedPath);
      logger.info(`[FFmpeg] ✅ Scene ${i} ready (${durationSec}s)`);
    }

    logger.info(`[FFmpeg] 🔗 Stitching clips together...`);
    const concatListPath = path.join(manualDir, 'concat_list.txt');
    const concatContent = sizedClips.map(c => `file '${path.basename(c)}'`).join('\n');
    await fs.writeFile(concatListPath, concatContent);

    const videoOnlyPath = path.join(manualDir, 'video_only.mp4');
    
    await new Promise((resolve, reject) => {
      ffmpeg(concatListPath.replace(/\\/g, '/'))
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c copy'])
        .save(videoOnlyPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`Concat error: ${err.message}`)));
    });

    logger.info(`[FFmpeg] 🎵 Merging audio track...`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoOnlyPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          '-shortest'
        ])
        .save(finalVideoPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`Merge error: ${err.message}`)));
    });

    // Cleanup temp files
    logger.info(`[FFmpeg] 🧹 Cleaning up temporary files...`);
    for (const clip of sizedClips) await fs.unlink(clip).catch(() => {});
    await fs.unlink(concatListPath).catch(() => {});
    await fs.unlink(videoOnlyPath).catch(() => {});

    logger.success(`[FFmpeg] 🚀 Fast render complete in seconds!`);
    return finalVideoPath;
  }

  private async fileExists(p: string) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
