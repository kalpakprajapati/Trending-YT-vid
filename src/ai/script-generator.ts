import { GoogleGenAI } from "@google/genai";
import { GeneratedScript } from "./types.js";
import {
  getStoryNarrationPrompt,
  getTitlePrompt,
  getDescriptionPrompt,
} from "./prompts.js";

export class ScriptGenerator {
  private ai: GoogleGenAI;
  private readonly MODEL = "gemini-3.5-flash-lite";

  /**
   * Initializes the ScriptGenerator.
   * @param apiKey The Gemini API key.
   */
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates a complete YouTube script with scenes, title, and metadata.
   * @param content The source content (title, body, comments).
   * @returns A promise resolving to the GeneratedScript.
   */
  async generateScript(content: {
    title: string;
    body: string;
    topComments: string[];
  }): Promise<GeneratedScript> {
    const prompt = getStoryNarrationPrompt(
      content.title,
      content.body,
      content.topComments,
    );

    return this.withRetry(async () => {
      console.log("[Script Generator] Starting critique session for script...");
      
      const interaction1 = await this.ai.interactions.create({
        model: this.MODEL,
        input: prompt,
      });

      console.log("[Script Generator] Critiquing and rewriting script...");
      const critiquePrompt = `
Analyze the script you just generated. 
- Ensure the hook starts exactly mid-action. 
- Ensure the pacing is extremely fast and engaging.
- Make any necessary improvements to maximize viewer retention.

Return the final, improved script using the EXACT SAME JSON structure as originally requested. Do not include any other text, only the JSON.
      `;
      const interaction2 = await this.ai.interactions.create({
        model: this.MODEL,
        input: critiquePrompt,
        previous_interaction_id: interaction1.id,
      });

      if (!interaction2.output_text) {
        throw new Error("No response text received from Gemini API");
      }

      const script = JSON.parse(interaction2.output_text) as GeneratedScript;

      // Basic validation
      if (
        !script.title ||
        !script.scenes ||
        script.scenes.length === 0 ||
        !script.hookLine
      ) {
        throw new Error("Generated script is missing required fields");
      }

      console.log("[Script Generator] Script generated successfully.");
      return script;
    });
  }

  /**
   * Generates alternative titles for a story.
   * @param story The story content.
   * @returns A promise resolving to an array of 5 title strings.
   */
  async generateTitles(story: string): Promise<string[]> {
    const prompt = getTitlePrompt(story);

    return this.withRetry(async () => {
      console.log("[Script Generator] Generating titles...");
      const response = await this.ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (!response.text) {
        throw new Error("No response text received from Gemini API");
      }

      const titles = JSON.parse(response.text);
      if (!Array.isArray(titles) || titles.length === 0) {
        throw new Error("Invalid titles format received");
      }

      console.log("[Script Generator] Titles generated successfully.");
      return titles;
    });
  }

  /**
   * Retries an async operation up to 3 times.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    attempts: number = 3,
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        console.warn(
          `[Script Generator] Attempt ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (i < attempts - 1) {
          const delayMs = 1000 * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw new Error(
      `Operation failed after ${attempts} attempts. Last error: ${lastError?.message}`,
    );
  }
}
