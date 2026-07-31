export interface Scene {
  text: string;           // narration text for TTS
  onScreenText?: string;  // shorter text to display on screen
  emotion: 'dramatic' | 'funny' | 'neutral' | 'suspenseful' | 'wholesome';
  imagePrompt: string;    // Highly descriptive visual prompt for AI image generation
  pauseAfterMs: number;   // pause after this scene
}

export interface GeneratedScript {
  title: string;          // YouTube video title (SEO optimized)
  description: string;    // YouTube description
  tags: string[];         // YouTube tags
  hookLine: string;       // first 5 seconds hook
  scenes: Scene[];
  outro: string;          // call to action
  estimatedDurationSec: number;
}
