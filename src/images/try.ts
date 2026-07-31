import { PollinationsImageGen } from "./pollinations.js";

export async function main() {
  const imageGen = new PollinationsImageGen({ width: 1080, height: 1920 });
  const result = await imageGen.generateImage("a simple cat", "outpath.jpg");
  console.log("Image saved to:", result);
}

main().catch(console.error);
