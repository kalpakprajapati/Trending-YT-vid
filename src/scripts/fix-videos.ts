import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
import { logger } from '../utils/logger.js';

const projectId = process.argv[2];

if (!projectId) {
  logger.error('Please provide a project ID. Example: npm run fix-videos my-project-id');
  process.exit(1);
}

const manualDir = path.resolve('output', projectId, 'images');

if (!existsSync(manualDir)) {
  logger.error(`Folder not found: ${manualDir}`);
  process.exit(1);
}

async function fixVideos() {
  const files = await fs.readdir(manualDir);
  const mp4Files = files.filter(f => f.endsWith('.mp4') && !f.endsWith('_fixed.mp4') && !f.endsWith('_sized.mp4'));

  if (mp4Files.length === 0) {
    logger.warn('No MP4 files found to fix.');
    return;
  }

  for (const file of mp4Files) {
    const inputPath = path.join(manualDir, file);
    const fixedPath = path.join(manualDir, file.replace('.mp4', '_fixed.mp4'));

    logger.info(`Fixing codec for ${file}...`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        // Convert to standard H.264 with yuv420p pixel format (highly compatible with Remotion/Chromium)
        .videoCodec('libx264')
        .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23'])
        // Remove audio track as Remotion handles our TTS audio separately
        .noAudio()
        .on('end', resolve)
        .on('error', reject)
        .save(fixedPath);
    });

    // Replace the old file with the fixed one
    await fs.unlink(inputPath);
    await fs.rename(fixedPath, inputPath);
    logger.success(`Successfully fixed ${file}!`);
  }

  logger.success('All videos fixed! You can now run `npm run render` again.');
}

fixVideos().catch(e => {
  logger.error(`Error fixing videos: ${e.message}`);
});
