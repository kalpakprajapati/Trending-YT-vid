import fs from 'node:fs/promises';
import path from 'node:path';

async function generateSubtitles() {
  const scriptPath = path.resolve('output', process.argv[2], 'scripts', 'script.json');
  const srtPath = path.resolve('output', process.argv[2], 'videos', `${process.argv[2]}.srt`);
  
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf-8'));
  
  const parts = [];
  if (script.hookLine) parts.push({ text: script.hookLine });
  script.scenes.forEach((s: any) => parts.push({ text: s.text }));
  if (script.outro) parts.push({ text: script.outro });

  const wordCounts = parts.map(p => p.text.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  
  const totalDurMs = (totalWords / 2.5) * 1000;
  
  function formatTime(ms: number) {
    const d = new Date(ms);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')},${String(d.getUTCMilliseconds()).padStart(3, '0')}`;
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
  console.log(`SRT generated at: ${srtPath}`);
}

generateSubtitles().catch(console.error);
