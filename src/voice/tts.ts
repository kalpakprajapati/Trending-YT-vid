import { exec } from 'child_process';
import { promisify } from 'util';
import { GeneratedScript } from '../ai/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export class VoiceGenerator {
  /**
   * Initializes the VoiceGenerator and checks if edge-tts is available.
   */
  constructor() {
    this.checkEdgeTts();
  }

  /**
   * Checks if edge-tts is installed.
   */
  private async checkEdgeTts() {
    try {
      await execAsync('edge-tts --version');
    } catch (err) {
      console.warn('edge-tts not found or failed to run. Please install it using: pip install edge-tts');
    }
  }

  /**
   * Generates audio for a given text.
   * @param text The narration text.
   * @param outputPath The path to save the generated audio file.
   * @param voice The voice model to use.
   * @returns A promise resolving to the output path.
   */
  async generateVoice(text: string, outputPath: string, voice: string = 'en-US-GuyNeural'): Promise<string> {
    try {
      if (text.length > 500) {
        // Use temp file for long texts
        const tempFilePath = path.join(os.tmpdir(), `tts_input_${Date.now()}.txt`);
        await fs.writeFile(tempFilePath, text, 'utf-8');
        
        const command = `edge-tts --voice "${voice}" --file "${tempFilePath}" --write-media "${outputPath}"`;
        await execAsync(command);
        
        await fs.unlink(tempFilePath).catch(() => {});
      } else {
        // Use direct text for short texts
        // Escape quotes to prevent command injection/syntax issues
        const escapedText = text.replace(/"/g, '\\"');
        const command = `edge-tts --voice "${voice}" --text "${escapedText}" --write-media "${outputPath}"`;
        await execAsync(command);
      }
      
      return outputPath;
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to generate voice: ${errorStr}`);
    }
  }

  /**
   * Generates a single audio file for an entire script.
   * @param script The generated script object.
   * @param outputDir The directory to save the output file.
   * @returns A promise resolving to the final audio file path.
   */
  async generateForScript(script: GeneratedScript, outputDir: string): Promise<string> {
    // Concatenate all script parts
    const parts = [
      script.hookLine,
      ...script.scenes.map(s => s.text),
      script.outro
    ];
    
    // Simple join with spacing. More advanced implementation could handle pauseAfterMs
    const fullText = parts.filter(Boolean).join('. ');
    
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, `script_audio_${Date.now()}.mp3`);
    console.log(`[Voice Generator] Generating audio for script to ${outputPath}...`);
    
    await this.generateVoice(fullText, outputPath);
    console.log('[Voice Generator] Audio generation complete.');
    
    return outputPath;
  }

  /**
   * Lists available voices from edge-tts.
   * @returns A promise resolving to an array of voice names.
   */
  async listVoices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('edge-tts --list-voices');
      // basic parsing: lines usually start with "Name: en-US-GuyNeural"
      const lines = stdout.split('\n');
      const voices: string[] = [];
      for (const line of lines) {
        const match = line.match(/^Name:\s*(\S+)/);
        if (match) {
          voices.push(match[1]);
        }
      }
      return voices;
    } catch (err) {
      console.error('Failed to list voices', err);
      return [];
    }
  }
}
