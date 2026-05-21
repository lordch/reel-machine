/**
 * Generate narration audio from ElevenLabs with word-level timestamps.
 *
 * Usage: npx tsx src/pipeline/generate-audio.ts <scenario-id>
 *
 * Reads: scenarios/{id}/scenario.json
 * Writes: scenarios/{id}/audio/narration.mp3
 *         scenarios/{id}/audio/narration-timestamps.json
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { loadScenario, resolveAvatarFromScenario, scenarioDir, type NarrationTimestamps } from "./schema.js";
import { PRICING } from "./config.js";
import { addCost } from "./costs.js";

const API_KEY = process.env.ELEVENLABS_API_KEY;

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

/**
 * TTS replacements set by API from Sheet config (Config.tts_replacements).
 */
let ttsReplacements: [RegExp, string][] = [];

export function setTtsReplacements(replacements: [RegExp, string][]): void {
  ttsReplacements = replacements;
}

export async function generateAudio(scenarioId: string): Promise<{
  audioPath: string;
  timestampsPath: string;
  duration: number;
}> {
  if (!API_KEY) {
    throw new Error("ELEVENLABS_API_KEY not set in environment");
  }

  const scenario = loadScenario(scenarioId);
  const resolved = resolveAvatarFromScenario(scenario);
  const dir = scenarioDir(scenarioId);
  const audioDir = path.join(dir, "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const ttsText = normalizeTTSText(scenario.script);

  console.log(`Generating audio for: "${scenario.meta.title}"`);
  console.log(`Avatar: ${scenario.avatar.name} → voice: ${resolved.voiceId}`);
  console.log(`Script (${scenario.script.split(/\s+/).length} words):\n${scenario.script}`);
  console.log(`TTS text:\n${ttsText}\n`);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${resolved.voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as ElevenLabsTimestampResponse;

  // Write MP3
  const audioPath = path.join(audioDir, "narration.mp3");
  const audioBuffer = Buffer.from(data.audio_base64, "base64");
  fs.writeFileSync(audioPath, audioBuffer);
  console.log(`Audio saved: ${audioPath} (${(audioBuffer.length / 1024).toFixed(0)} KB)`);

  // Convert character-level timestamps to word-level,
  // then map back to original script words for captions
  const ttsWords = charactersToWords(data.alignment);
  const words = mapBackToOriginal(scenario.script, ttsText, ttsWords);

  const totalDuration = words.length > 0
    ? words[words.length - 1].end
    : 0;

  const timestamps: NarrationTimestamps = { words, totalDuration };

  const timestampsPath = path.join(audioDir, "narration-timestamps.json");
  fs.writeFileSync(timestampsPath, JSON.stringify(timestamps, null, 2));
  console.log(`Timestamps saved: ${timestampsPath} (${words.length} words, ${totalDuration.toFixed(1)}s)`);

  // Track cost
  const charCount = ttsText.length;
  const cost = (charCount / 1000) * PRICING.elevenlabsTtsPerKChar;
  addCost(scenarioId, { step: "audio", provider: "elevenlabs", detail: `${charCount} chars, ${totalDuration.toFixed(1)}s`, cost });

  return { audioPath, timestampsPath, duration: totalDuration };
}

/**
 * Normalize script text for better TTS pronunciation.
 * Uses product-specific replacements loaded from product.json.
 */
function normalizeTTSText(script: string): string {
  let text = script;
  for (const [pattern, replacement] of ttsReplacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

/**
 * Map TTS word timestamps back to original script words.
 */
function mapBackToOriginal(
  original: string,
  ttsText: string,
  ttsWords: NarrationTimestamps["words"],
): NarrationTimestamps["words"] {
  const origWords = original.split(/\s+/).filter(Boolean);
  const result: NarrationTimestamps["words"] = [];
  let ttsIdx = 0;

  for (const origWord of origWords) {
    let normalized = origWord;
    for (const [pattern, replacement] of ttsReplacements) {
      normalized = normalized.replace(pattern, replacement);
    }
    const expandedCount = normalized.split(/\s+/).filter(Boolean).length;

    if (ttsIdx < ttsWords.length) {
      const start = ttsWords[ttsIdx].start;
      const lastIdx = Math.min(ttsIdx + expandedCount - 1, ttsWords.length - 1);
      const end = ttsWords[lastIdx].end;
      result.push({ word: origWord, start, end });
    }

    ttsIdx += expandedCount;
  }

  return result;
}

/**
 * Convert ElevenLabs character-level alignment to word-level timestamps.
 */
function charactersToWords(alignment: ElevenLabsTimestampResponse["alignment"]): NarrationTimestamps["words"] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const words: NarrationTimestamps["words"] = [];

  let currentWord = "";
  let wordStart = 0;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (char === " " || char === "\n") {
      if (currentWord.length > 0) {
        words.push({ word: currentWord, start: wordStart, end: wordEnd });
        currentWord = "";
      }
    } else {
      if (currentWord.length === 0) {
        wordStart = character_start_times_seconds[i];
      }
      currentWord += char;
      wordEnd = character_end_times_seconds[i];
    }
  }

  if (currentWord.length > 0) {
    words.push({ word: currentWord, start: wordStart, end: wordEnd });
  }

  return words;
}

// ── CLI (only when run directly, not imported) ──
const __isMain = process.argv[1]?.includes("generate-audio");
if (__isMain) {
  const scenarioId = process.argv[2];

  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/generate-audio.ts <scenario-id>");
    process.exit(1);
  }

  generateAudio(scenarioId)
    .then(({ duration }) => {
      console.log(`\nDone! Narration duration: ${duration.toFixed(1)}s`);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
