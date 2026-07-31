import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config.js';

const BASE_URL = 'https://gen.pollinations.ai/image';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BETWEEN_REQUESTS_MS = 3000; // 3s gap between requests to avoid rate limits

export interface ImageGenOptions {
  width?: number;
  height?: number;
  nologo?: boolean;
  model?: string;
}

/**
 * Downloads AI-generated images from Pollinations.ai (free, no API key needed).
 * Requests are made sequentially with retry logic to avoid rate limits.
 */
export class PollinationsImageGen {
  private defaultOptions: Required<ImageGenOptions>;

  constructor(options?: ImageGenOptions) {
    this.defaultOptions = {
      width: options?.width || 1080,
      height: options?.height || 1920,
      nologo: options?.nologo ?? true,
      model: options?.model ?? 'flux'
    };
  }

  /**
   * Generate and download a single image from a text prompt.
   * Retries up to MAX_RETRIES times on failure.
   */
  async generateImage(prompt: string, outputPath: string): Promise<string> {
    const { width, height, model } = this.defaultOptions;
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${BASE_URL}/${encodedPrompt}?width=${width}&height=${height}&model=${model}`;
    const apiKey = config.POLLINATION_API_KEY ?? '';

    let lastError = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Pollinations] ${attempt > 1 ? `Retry ${attempt}/${MAX_RETRIES}: ` : ''}Generating: "${prompt.substring(0, 55)}..."`);

        const response = await fetch(url, {
          redirect: 'follow',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          signal: AbortSignal.timeout(60000), // 60s timeout per request
        });

        console.log(response)

        if (response.status === 429) {
          throw new Error('Rate limited (429)');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Verify we got a real image (at least 10KB)
        if (buffer.length < 10000) {
          throw new Error(`Response too small (${buffer.length} bytes), likely not a valid image`);
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, buffer);
        console.log(`[Pollinations] ✅ Saved (${(buffer.length / 1024).toFixed(0)}KB)`);
        return outputPath;

      } catch (err: any) {
        lastError = err.message || String(err);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt; // Exponential-ish backoff
          console.log(err)
          console.warn(`[Pollinations] ⚠️ Attempt ${attempt} failed: ${lastError}. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
        }
      }
    }

    console.warn(`[Pollinations] ❌ Failed after ${MAX_RETRIES} attempts: ${lastError}`);
    return ''; // Return empty = no image for this scene (will fall back to gradient)
  }

  /**
   * Generate images for multiple scenes SEQUENTIALLY to avoid rate limits.
   * Returns an array of local file paths (empty string for failed scenes).
   */
  async generateForScenes(
    scenes: Array<{ text: string; emotion?: string; imagePrompt?: string }>,
    outputDir: string,
    storyTitle: string
  ): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const results: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const prompt = buildScenePrompt(scene);
      const filename = `scene_${i}_${Date.now()}.jpg`;
      const outputPath = path.join(outputDir, filename);

      const result = await this.generateImage(prompt, outputPath);
      results.push(result);

      // Wait between requests to stay under rate limits
      if (i < scenes.length - 1) {
        await sleep(BETWEEN_REQUESTS_MS);
      }
    }

    return results;
  }
}

/**
 * Build a cinematic image prompt from the scene's dedicated image prompt or text.
 */
function buildScenePrompt(scene: { text: string; emotion?: string; imagePrompt?: string }): string {
  // Use the AI's dedicated visual prompt if available, else fallback to text snippet
  const coreIdea = scene.imagePrompt || scene.text.split(/\s+/).slice(0, 15).join(' ');

  // Force bright, high-quality, relevant images (no dark moody stuff by default)
  const baseStyle = 'photorealistic, 8k resolution, highly detailed, bright and clear lighting, dynamic composition, vertical 9:16, no text, no emojis, no watermark, cinematic';

  return `${coreIdea}, ${baseStyle}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { buildScenePrompt };
