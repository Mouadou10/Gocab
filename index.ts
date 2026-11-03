import { generateText } from "ai";
import fs from "fs";

// Automatically load .env.local if AI_GATEWAY_API_KEY is not already in process.env
if (!process.env.AI_GATEWAY_API_KEY && fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
}

async function main() {
  const { text } = await generateText({
    model: "google/gemini-2.5-flash",
    prompt: "Invent a new holiday and describe its traditions.",
  });

  console.log(text);
}

main().catch(console.error);
