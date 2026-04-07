/**
 * Generate background music using ElevenLabs Music API with per-section control.
 *
 * Usage: npx tsx src/pipeline/generate-music.ts <scenario-id>
 *
 * Reads:  scenarios/{id}/scenario.json
 *         scenarios/{id}/audio/narration-timestamps.json  (must run after generate-audio)
 * Writes: scenarios/{id}/audio/music.mp3
 *
 * Builds a composition_plan from scenario musicSection tags + word timestamps
 * to align music intensity with narration (intro → product → cta).
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { addCost } from "./costs.js";
import { PRICING } from "./config.js";
import {
  loadScenario,
  loadTimestamps,
  scenarioDir,
  type Scene,
  type NarrationTimestamps,
} from "./schema.js";
import { DEFAULTS } from "./config.js";

const API_KEY = process.env.ELEVENLABS_API_KEY;

// Default section styles from global config
const DEFAULT_SECTION_STYLES = DEFAULTS.music.sectionStyles;

// ── Build music sections from scenes + timestamps ──

interface MusicSectionTiming {
  name: string;
  durationMs: number;
  positive: string[];
  negative: string[];
}

function buildMusicSections(
  scenes: Scene[],
  timestamps: NarrationTimestamps,
  sectionStyles?: Record<string, { positive: string[]; negative: string[] }>,
): MusicSectionTiming[] {
  // Align scenes to audio (simplified — matches assemble.ts logic)
  const words = timestamps.words;
  let wordCursor = 0;

  const sceneTimes = scenes.map((scene) => {
    const segmentWords = scene.scriptSegment
      .replace(/[.,!?;:'"—–\-]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (segmentWords.length === 0 || wordCursor >= words.length) {
      const fallback = wordCursor < words.length ? words[wordCursor].start : timestamps.totalDuration;
      return { section: scene.musicSection, start: fallback, end: fallback + 1 };
    }

    const firstTarget = segmentWords[0];
    let matchStart = wordCursor;
    for (let i = wordCursor; i < words.length; i++) {
      if (words[i].word.replace(/[.,!?;:'"—–\-]/g, "").toLowerCase() === firstTarget) {
        matchStart = i;
        break;
      }
    }

    const lastTarget = segmentWords[segmentWords.length - 1];
    let matchEnd = matchStart;
    for (let i = matchStart; i < words.length; i++) {
      if (
        words[i].word.replace(/[.,!?;:'"—–\-]/g, "").toLowerCase() === lastTarget &&
        i >= matchStart + segmentWords.length - 2
      ) {
        matchEnd = i;
        break;
      }
    }
    wordCursor = matchEnd + 1;

    return {
      section: scene.musicSection,
      start: words[matchStart].start,
      end: words[matchEnd].end,
    };
  });

  // Group consecutive scenes with the same musicSection
  const groups: { name: string; startSec: number; endSec: number }[] = [];
  for (let i = 0; i < sceneTimes.length; i++) {
    const s = sceneTimes[i];
    const nextStart = i + 1 < sceneTimes.length ? sceneTimes[i + 1].start : timestamps.totalDuration;
    const sceneEnd = nextStart; // extend to next scene start (fill gaps)

    if (groups.length > 0 && groups[groups.length - 1].name === s.section) {
      groups[groups.length - 1].endSec = sceneEnd;
    } else {
      groups.push({ name: s.section, startSec: s.start, endSec: sceneEnd });
    }
  }

  // First section always starts at 0
  if (groups.length > 0) groups[0].startSec = 0;

  // Convert to ElevenLabs sections
  const styles = { ...DEFAULT_SECTION_STYLES, ...sectionStyles };

  return groups.map((g) => {
    const durationMs = Math.max(3000, Math.round((g.endSec - g.startSec) * 1000));
    const s = (styles as Record<string, { positive: string[]; negative: string[] }>)[g.name] || DEFAULT_SECTION_STYLES.intro;
    return {
      name: g.name,
      durationMs,
      positive: s.positive,
      negative: s.negative,
    };
  });
}

// ── Generate music via ElevenLabs Music API ──

const SHARED_MUSIC_PATH = path.join(process.cwd(), "public", "shared-music.mp3");

export async function generateMusic(scenarioId: string): Promise<string> {
  const scenario = loadScenario(scenarioId);
  const dir = scenarioDir(scenarioId);
  const audioDir = path.join(dir, "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const outputPath = path.join(audioDir, "music.mp3");

  if (!scenario.music.regenerate) {
    // 1. Per-scenario file exists — reuse it
    if (fs.existsSync(outputPath)) {
      console.log(`Reusing existing music: ${outputPath}`);
      return outputPath;
    }
    // 2. Shared workspace file exists — copy it to this scenario
    if (fs.existsSync(SHARED_MUSIC_PATH)) {
      fs.copyFileSync(SHARED_MUSIC_PATH, outputPath);
      console.log(`Copied shared music → ${outputPath}`);
      return outputPath;
    }
    // 3. Neither exists — will generate below and save to both
  }

  if (!API_KEY) {
    console.error("ELEVENLABS_API_KEY not set. Cannot generate music.");
    return "";
  }

  // Try to load timestamps for dynamic per-scene sections
  let timestamps: NarrationTimestamps | null = null;
  try {
    timestamps = loadTimestamps(scenarioId);
  } catch {
    // No timestamps — will use generic fallback track
  }

  if (scenario.music.regenerate && !timestamps) {
    console.warn("  ⚠ regenerate=true but no timestamps found — falling back to generic track");
  }

  let sections: MusicSectionTiming[];

  if (timestamps && scenario.music.regenerate) {
    // Dynamic mode: build sections from actual scene timing
    sections = buildMusicSections(
      scenario.scenes,
      timestamps,
      scenario.music.sectionStyles as Record<string, { positive: string[]; negative: string[] }> | undefined,
    );
  } else {
    // Generic fallback: 40s (or configured) split into 3 proportional sections
    const totalMs = scenario.music.fallbackDurationSec * 1000;
    const styles = { ...DEFAULT_SECTION_STYLES, ...(scenario.music.sectionStyles as Record<string, { positive: string[]; negative: string[] }> | undefined) };
    sections = [
      { name: "intro",   durationMs: Math.round(totalMs * 0.25), positive: (styles.intro || DEFAULT_SECTION_STYLES.intro).positive,   negative: (styles.intro || DEFAULT_SECTION_STYLES.intro).negative },
      { name: "product", durationMs: Math.round(totalMs * 0.50), positive: (styles.product || DEFAULT_SECTION_STYLES.product).positive, negative: (styles.product || DEFAULT_SECTION_STYLES.product).negative },
      { name: "cta",     durationMs: Math.round(totalMs * 0.25), positive: (styles.cta || DEFAULT_SECTION_STYLES.cta).positive,     negative: (styles.cta || DEFAULT_SECTION_STYLES.cta).negative },
    ];
  }

  const totalDurationMs = sections.reduce((sum, s) => sum + s.durationMs, 0);

  const mode = (timestamps && scenario.music.regenerate) ? "dynamic (per-clip)" : "generic fallback";
  console.log(`Generating music — ${mode} (${(totalDurationMs / 1000).toFixed(1)}s):`);
  console.log(`  Styles: ${scenario.music.styles.join(", ")}`);
  console.log(`  Sections:`);
  sections.forEach((s) => {
    console.log(`    ${s.name}: ${(s.durationMs / 1000).toFixed(1)}s — ${s.positive.join(", ")}`);
  });

  // Call ElevenLabs Music API
  const body = {
    composition_plan: {
      positive_global_styles: scenario.music.styles,
      negative_global_styles: scenario.music.negativeStyles.length > 0
        ? scenario.music.negativeStyles
        : DEFAULTS.music.negativeStyles,
      respect_sections_durations: true,
      sections: sections.map((s) => ({
        section_name: s.name,
        duration_ms: s.durationMs,
        positive_local_styles: s.positive,
        negative_local_styles: s.negative,
        lines: [],
      })),
    },
  };

  console.log("\n  Calling ElevenLabs Music API...");

  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Failed (${res.status}): ${err}`);
    return "";
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  // Save to shared workspace path so future scenarios can reuse without regenerating
  if (!scenario.music.regenerate) {
    fs.mkdirSync(path.dirname(SHARED_MUSIC_PATH), { recursive: true });
    fs.copyFileSync(outputPath, SHARED_MUSIC_PATH);
    console.log(`  Saved to shared: ${SHARED_MUSIC_PATH}`);
  }

  const durationSec = totalDurationMs / 1000;
  console.log(`\n  Music saved: ${outputPath} (${Math.round(buffer.length / 1024)} KB)`);

  const musicCost = (durationSec / 60) * PRICING.elevenlabsMusicPerMinute;
  addCost(scenarioId, { step: "music", provider: "elevenlabs", detail: `${durationSec.toFixed(1)}s`, cost: musicCost });

  return outputPath;
}

// ── CLI (only when run directly) ──
const __isMain = process.argv[1]?.includes("generate-music");
if (__isMain) {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/generate-music.ts <scenario-id>");
    process.exit(1);
  }

  generateMusic(scenarioId)
    .then((file) => {
      if (file) console.log("\nDone:", file);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
