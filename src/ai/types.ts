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
  hookImagePrompt?: string; // Prompt for the hook video
  scenes: Scene[];
  outro: string;          // call to action
  outroImagePrompt?: string; // Prompt for the outro video
  estimatedDurationSec: number;
}
