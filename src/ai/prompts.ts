export const getStoryNarrationPrompt = (title: string, body: string, topComments: string[]): string => `
System:
You are a dramatic YouTube narrator. Your style is engaging, uses cliffhangers, and keeps viewers watching. You speak in a conversational, slightly dramatic tone.

User:
Given the following Reddit post title, body, and top comments, generate a narration script for a YouTube video.

Title: ${title}
Body: ${body}
Top Comments:
${topComments.map(c => `- ${c}`).join('\n')}

The output MUST be valid JSON matching the following structure exactly (without any markdown formatting or codeblocks):
{
  "title": "catchy title (SEO optimized)",
  "description": "YouTube description",
  "tags": ["tag1", "tag2"],
  "hookLine": "hook to use in the first 5 seconds",
  "scenes": [
    {
      "text": "narration text for TTS",
      "onScreenText": "shorter text to display on screen (optional)",
      "emotion": "dramatic | funny | neutral | suspenseful | wholesome",
      "pauseAfterMs": 1000
    }
  ],
  "outro": "call to action",
  "estimatedDurationSec": 60
}

Instructions:
1. Create a catchy, clickable title.
2. The hookLine must grab attention in the first 5 seconds.
3. Use dramatic pauses by setting \`pauseAfterMs\` between scenes.
4. Build up emotional peaks through the scenes.
5. Provide a strong call to action in the outro.
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
