import * as fs from 'node:fs/promises';
import { GeneratedScript } from '../ai/types.js';

function formatTime(ms: number) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')},${String(d.getUTCMilliseconds()).padStart(3, '0')}`;
}

export async function generateSrt(
  script: GeneratedScript,
  audioDurationMs: number,
  srtPath: string
): Promise<void> {
  const parts = [];
  if (script.hookLine) parts.push({ text: script.hookLine });
  script.scenes.forEach(s => parts.push({ text: s.text }));
  if (script.outro) parts.push({ text: script.outro });

  const wordCounts = parts.map(p => p.text.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  
  let totalDurMs = audioDurationMs;
  if (!totalDurMs || totalDurMs <= 0) {
    totalDurMs = (totalWords / 2.5) * 1000;
  }

  let srtContent = '';
  let currentTimeMs = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const durationMs = (wordCounts[i] / totalWords) * totalDurMs;
    const start = formatTime(currentTimeMs);
    const end = formatTime(currentTimeMs + durationMs);
    
    srtContent += `${i + 1}\n`;
    srtContent += `${start} --> ${end}\n`;
    srtContent += `${parts[i].text}\n\n`;
    
    currentTimeMs += durationMs;
  }
  
  await fs.writeFile(srtPath, srtContent);
}
