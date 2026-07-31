import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { logger } from '../utils/logger.js';

const PROFILE_DIR = path.resolve('chrome-profile');

export class GoogleFlowVideoGen {
  /**
   * Run this manually once to log into Google and save the session.
   */
  static async setupLogin() {
    logger.info('[Google Flow] Opening browser for manual login...');
    logger.info(`[Google Flow] Saving profile to: ${PROFILE_DIR}`);
    
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false, // Must be visible so you can log in
      channel: 'chrome', // Force using actual Google Chrome to bypass security blocks
      args: ['--disable-blink-features=AutomationControlled'], // Hide automation flags
    });
    const page = await context.newPage();
    
    logger.info('[Google Flow] Navigating to Google Labs Flow project...');
    await page.goto('https://labs.google/fx/tools/flow/project/d352e527-940c-46e4-a233-69f0d9483941');
    
    logger.warn('[Google Flow] 🚨 ACTION REQUIRED 🚨');
    logger.warn('[Google Flow] Please log into your Google Account in the opened browser.');
    logger.warn('[Google Flow] Once you see the Google Flow UI and are fully logged in, just close the browser window!');
    
    // The script will stay alive until the user closes the browser context
    context.on('close', () => {
      logger.success('[Google Flow] Browser closed. Profile saved successfully!');
      process.exit(0);
    });
  }

  /**
   * Generates videos for multiple scenes
   */
  async generateForScenes(
    scenes: Array<{ text: string; emotion?: string; imagePrompt?: string }>,
    outputDir: string,
    storyTitle: string
  ): Promise<string[]> {
    if (!existsSync(PROFILE_DIR)) {
      throw new Error(`[Google Flow] Chrome profile not found! Please run 'npm run setup:flow' first to log in.`);
    }

    await fs.mkdir(outputDir, { recursive: true });
    
    logger.info('[Google Flow] Launching browser with saved profile...');
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false, // Google often blocks headless even with a profile. Running headed is safer.
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const page = await context.newPage();
    await page.goto('https://labs.google/fx/tools/flow/project/d352e527-940c-46e4-a233-69f0d9483941', { waitUntil: 'networkidle' });

    const results: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      // Use the AI's detailed image prompt, or fallback to the first 15 words of text
      const prompt = scene.imagePrompt || scene.text.split(/\s+/).slice(0, 15).join(' ');
      const filename = `scene_${i}_${Date.now()}.mp4`; // Note this is .mp4 now
      const outputPath = path.join(outputDir, filename);

      logger.info(`[Google Flow] Scene ${i + 1}/${scenes.length}: Typing prompt...`);
      
      try {
        // --- SPECULATIVE SELECTORS ---
        // Since we don't know the exact DOM of labs.google/fx/tools/flow, 
        // these selectors assume a standard textarea and a button containing "Generate"
        
        // 1. Find the input box
        const inputBox = await page.waitForSelector('textarea, input[type="text"]', { timeout: 15000 });
        if (!inputBox) throw new Error("Could not find prompt input box");
        await inputBox.fill(prompt);

        // 2. Click Generate
        // This looks for a button that contains the text "Generate" or "Create"
        const generateBtn = await page.waitForSelector('button:has-text("Generate"), button:has-text("Create")', { timeout: 5000 });
        if (!generateBtn) throw new Error("Could not find Generate button");
        await generateBtn.click();

        logger.info(`[Google Flow] Scene ${i + 1}: Waiting for generation (this might take 1-3 minutes)...`);
        
        // 3. Wait for the video result
        // We look for a video tag to appear in the DOM
        const videoElement = await page.waitForSelector('video', { timeout: 180000 }); // 3 min timeout
        
        // Extract the video source URL
        const videoUrl = await videoElement.evaluate((el: HTMLVideoElement) => el.src || el.currentSrc);
        
        if (videoUrl) {
          logger.info(`[Google Flow] Scene ${i + 1}: Downloading video...`);
          // Download the video buffer using the browser page (bypasses auth/CORS)
          const buffer = await page.evaluate(async (url) => {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          }, videoUrl);
          
          await fs.writeFile(outputPath, Buffer.from(buffer));
          results.push(outputPath);
          logger.success(`[Google Flow] Scene ${i + 1} saved to ${filename}!`);
        } else {
          logger.error(`[Google Flow] Scene ${i + 1}: Video element found but URL was missing.`);
          results.push('');
        }

      } catch (err: any) {
        logger.error(`[Google Flow] Failed scene ${i + 1}: ${err.message}`);
        logger.warn(`[Google Flow] The UI selectors might need to be updated to match Google's current layout.`);
        results.push('');
      }
    }

    await context.close();
    return results;
  }
}
