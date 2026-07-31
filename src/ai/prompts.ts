export const getStoryNarrationPrompt = (title: string, body: string, topComments: string[]): string => `
System:
You are an expert YouTube strategist and dramatic storyteller. Your goal is to maximize Click-Through Rate (CTR) and viewer retention. Your style is engaging, uses cliffhangers, and keeps viewers hooked.

User:
Given the following Reddit post title, body, and top comments, generate a narration script AND highly viral metadata for a YouTube Shorts/Video.

Title: ${title}
Body: ${body}
Top Comments:
${(topComments || []).map(c => `- ${c}`).join('\n')}

The output MUST be valid JSON matching the following structure exactly (without any markdown formatting or codeblocks):
{
  "title": "CATCHY VIRAL TITLE HERE (Keep under 60 chars)",
  "description": "Viral description here...",
  "tags": ["viral", "reddit", "story"],
  "hookLine": "hook to use in the first 5 seconds",
  "scenes": [
    {
      "text": "narration text for TTS",
      "onScreenText": "shorter text to display on screen (optional)",
      "emotion": "dramatic | funny | neutral | suspenseful | wholesome",
      "imagePrompt": "A brightly lit modern office building at noon, professional photography",
      "pauseAfterMs": 1000
    }
  ],
  "outro": "call to action",
  "estimatedDurationSec": 60
}

Instructions for Virality & Quality:
1. TITLE: Must be extreme clickbait but true to the story. Use extreme emotion, curiosity gaps, and ALL CAPS for emphasis. Keep under 60 characters so it doesn't cut off on mobile.
2. DESCRIPTION: Start with a hook. Include 3-5 relevant hashtags (#reddit #storytime). Make the algorithm love it by naturally weaving in keywords. Add a CTA to subscribe.
3. TAGS: Include exactly 15 highly searched, relevant tags. Mix broad tags ("reddit stories") with niche tags.
4. HOOK LINE: Must grab attention in the first 3 seconds (e.g. "What would you do if...").
5. SCENES: Build up emotional peaks through the scenes using dramatic pauses.
6. IMAGE PROMPT: For each scene, write a highly descriptive visual prompt that describes exactly what should be on screen. Do NOT include any text in the prompt. Do NOT make the scene dark or gloomy unless absolutely necessary; prefer bright, clear, dynamic compositions.
7. NO EMOJIS: Do absolutely NOT use emojis anywhere in the JSON output (not in the title, description, text, or onScreenText).
`;

export const getTitlePrompt = (story: string): string => `
Generate 5 catchy, highly clickable YouTube video titles for the following story. 
The titles should be SEO-optimized and appeal to a broad audience.

Story:
${story}

Return ONLY a JSON array of 5 strings. Example: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]
`;

export const getDescriptionPrompt = (title: string, story: string): string => `
Generate an SEO-optimized YouTube video description for the following video title and story.
Include relevant keywords, a brief summary, and standard boilerplate (like subscribe prompt).

Title: ${title}
Story: ${story}

Return plain text for the description.
`;
