import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import { GeneratedScript } from '../ai/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { opendir } from 'fs';

const execAsync = promisify(exec);

const EDGE_TTS_MAX_RETRIES = 5;
const EDGE_TTS_RETRY_DELAY_MS = 3000;

export interface TtsResult {
  audioPath: string;
  totalDurationMs: number;
  provider: 'gemini' | 'edge-tts';
}

/**
 * Voice generator with Gemini TTS as primary and edge-tts as fallback.
 * 
 * Strategy:
 *   1. Try Gemini TTS first (higher quality, 10 RPD free tier)
 *   2. If Gemini quota exhausted or errors, fall back to edge-tts
 */
export class VoiceGenerator {
  private geminiClient: GoogleGenAI | null = null;
  private geminiVoice: string;
  private edgeTtsVoice: string;
  private geminiVoiceModel: string;

  constructor(options?: { geminiApiKey?: string; geminiVoice?: string; edgeTtsVoice?: string, geminiVoiceModel?: string }) {
    if (options?.geminiApiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: options.geminiApiKey });
    }
    // Charon = informative clear male voice, great for news/narration
    this.geminiVoice = options?.geminiVoice || 'Charon';
    this.edgeTtsVoice = options?.edgeTtsVoice || 'en-US-GuyNeural';
    this.geminiVoiceModel = options?.geminiVoiceModel || 'gemini-2.5-flash-preview-tts';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generates a single audio file for an entire script.
   * Tries Gemini TTS first, falls back to edge-tts on failure.
   */
  async generateForScript(script: GeneratedScript, outputDir: string, projectId: string = 'script_audio'): Promise<TtsResult> {
    const hook = script.hookLine || '';
    const scenes = script.scenes.map(s => s.text).join('\n\n');
    const outro = script.outro || '';
    
    const fullText = [hook, scenes, outro].filter(Boolean).join('\n\n');
    
    await fs.mkdir(outputDir, { recursive: true });
    
    // ── Attempt 1: Gemini TTS ──
    if (this.geminiClient) {
      try {
        console.log(`[Voice Generator] 🔮 Trying Gemini TTS (voice: ${this.geminiVoice})...`);
        const outputPath = path.join(outputDir, `${projectId}.wav`);
        const result = await this.generateWithGemini(fullText, outputPath);
        console.log(`[Voice Generator] ✅ Gemini TTS success! Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
        return result;
      } catch (err: any) {
        const msg = err.message || String(err);
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`[Voice Generator] ⚠️ Gemini TTS quota exhausted. Falling back to edge-tts...`);
        } else {
          console.warn(`[Voice Generator] ⚠️ Gemini TTS failed: ${msg}. Falling back to edge-tts...`);
        }
      }
    } else {
      console.log(`[Voice Generator] No Gemini API key configured, using edge-tts directly.`);
    }

    // ── Attempt 2: Edge-TTS fallback ──
    console.log(`[Voice Generator] 🎙️ Using edge-tts (voice: ${this.edgeTtsVoice})...`);
    const outputPath = path.join(outputDir, `${projectId}.mp3`);
    const result = await this.generateWithEdgeTts(fullText, outputPath);
    console.log(`[Voice Generator] ✅ edge-tts success! Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Gemini TTS Provider
  // ═══════════════════════════════════════════════════════════════════════

  private async generateWithGemini(text: string, outputPath: string): Promise<TtsResult> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    const response = await this.geminiClient.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.geminiVoice,
            },
          },
        },
      },
    });

    // Extract audio data from response
    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (!part || !part.inlineData?.data) {
      throw new Error('No audio data in Gemini response');
    }

    const audioBuffer = Buffer.from(part.inlineData.data, 'base64');

    // Gemini returns raw PCM (L16, 24kHz, mono). Wrap it in a WAV header.
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const numChannels = 1;
    const wavBuffer = createWavBuffer(audioBuffer, sampleRate, bitsPerSample, numChannels);

    await fs.writeFile(outputPath, wavBuffer);

    // Calculate duration from PCM data length
    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = audioBuffer.length / (bytesPerSample * numChannels);
    const totalDurationMs = (totalSamples / sampleRate) * 1000;

    return { audioPath: outputPath, totalDurationMs, provider: 'gemini' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Edge-TTS Provider (fallback)
  // ═══════════════════════════════════════════════════════════════════════

  private async generateWithEdgeTts(text: string, outputPath: string): Promise<TtsResult> {
    const vttPath = outputPath.replace(/\.mp3$/, '.vtt');
    let lastError = '';

    for (let attempt = 1; attempt <= EDGE_TTS_MAX_RETRIES; attempt++) {
      try {
        if (text.length > 500) {
          const tempFilePath = path.join(os.tmpdir(), `tts_input_${Date.now()}.txt`);
          await fs.writeFile(tempFilePath, text, 'utf-8');

          const command = `python -m edge_tts --voice "${this.edgeTtsVoice}" --file "${tempFilePath}" --write-media "${outputPath}" --write-subtitles "${vttPath}"`;
          await execAsync(command);

          await fs.unlink(tempFilePath).catch(() => {});
        } else {
          const escapedText = text.replace(/"/g, '\\"');
          const command = `python -m edge_tts --voice "${this.edgeTtsVoice}" --text "${escapedText}" --write-media "${outputPath}" --write-subtitles "${vttPath}"`;
          await execAsync(command);
        }

        // Verify audio was created
        await fs.access(outputPath);

        // Parse VTT to get actual total duration
        let totalDurationMs = 0;
        try {
          const vttContent = await fs.readFile(vttPath, 'utf-8');
          totalDurationMs = parseVttDuration(vttContent);
        } catch {
          // Fallback: estimate from word count
          const words = text.split(/\s+/).length;
          totalDurationMs = (words / 3.0) * 1000;
          console.warn(`[Voice Generator] Could not parse VTT, estimating duration.`);
        }

        return { audioPath: outputPath, totalDurationMs, provider: 'edge-tts' };

      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < EDGE_TTS_MAX_RETRIES) {
          console.warn(`[Voice Generator] edge-tts attempt ${attempt}/${EDGE_TTS_MAX_RETRIES} failed. Retrying in ${EDGE_TTS_RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, EDGE_TTS_RETRY_DELAY_MS));
        }
      }
    }

    throw new Error(`Failed to generate voice after ${EDGE_TTS_MAX_RETRIES} edge-tts attempts: ${lastError}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a WAV file buffer from raw PCM data by prepending a RIFF/WAVE header.
 */
function createWavBuffer(pcmData: Buffer, sampleRate: number, bitsPerSample: number, numChannels: number): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const header = Buffer.alloc(headerSize);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // Sub-chunk size (16 for PCM)
  header.writeUInt16LE(1, 20);            // Audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Parses a VTT/SRT subtitle file and returns the last timestamp in ms.
 */
function parseVttDuration(vttContent: string): number {
  const timestampRegex = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/g;
  let maxMs = 0;
  let match: RegExpExecArray | null;

  while ((match = timestampRegex.exec(vttContent)) !== null) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const ms = parseInt(match[4], 10);
    const totalMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
    if (totalMs > maxMs) maxMs = totalMs;
  }

  return maxMs;
}
