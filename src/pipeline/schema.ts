import { z } from "zod";
import { AVATAR_LIBRARY, DEFAULTS, resolveAvatar } from "./config.js";

// ── Text position & animation (mirrors src/types.ts) ──

export const TextPositionSchema = z.enum([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

export const TextAnimationSchema = z.enum([
  "pop", "slide-left", "slide-right", "slam",
  "fade-up", "rotate-in", "zoom-out",
]);

export const CaptionStyleSchema = z.enum([
  "bold-pop", "typewriter", "glow-neon", "karaoke",
  "slide-up", "glitch", "kinetic",
]);

// ── Avatar config ──

export const AvatarConfigSchema = z.object({
  name: z.string().default(DEFAULTS.avatar),
  avatarId: z.string().optional(),
  avatarStyle: z.enum(["normal", "closeUp", "circle"]).default(DEFAULTS.avatarStyle),
  offset: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  talkingStyle: z.enum(["stable", "expressive"]).default(DEFAULTS.talkingStyle),
  expression: z.enum(["default", "happy"]).default(DEFAULTS.expression),
  matting: z.boolean().default(DEFAULTS.matting),
  circleBackgroundColor: z.string().optional(),
});

// ── Scene ──

export const SceneSchema = z.object({
  id: z.string(),
  scriptSegment: z.string(),
  visual: z.enum(["avatar", "broll", "screenshot"]),
  musicSection: z.enum(["intro", "product", "cta"]),
  brollAiPrompt: z.string().optional(),
  brollQuery: z.string().optional(),
  /** B-roll category — picks random prompt from product's broll-library.json */
  brollCategory: z.string().optional(),
  brollSource: z.enum(["stock", "ai"]).optional(),
  screenshotAsset: z.string().optional(),
  overlay: z.object({
    text: z.string(),
    position: TextPositionSchema,
    animation: TextAnimationSchema,
    fontSize: z.number().optional(),
    color: z.string().optional(),
    accentColor: z.string().optional(),
    rotation: z.number().optional(),
    emoji: z.string().optional(),
  }).optional(),
});

// ── ReelScenario ──

export const ReelScenarioSchema = z.object({
  id: z.string(),

  meta: z.object({
    title: z.string(),
    targetDuration: z.number().min(10).max(90),
    language: z.literal("en").default("en"),
  }),

  avatar: AvatarConfigSchema.default({
    name: DEFAULTS.avatar,
    avatarStyle: DEFAULTS.avatarStyle,
    talkingStyle: DEFAULTS.talkingStyle,
    expression: DEFAULTS.expression,
    matting: DEFAULTS.matting,
  }),

  script: z.string(),
  scenes: z.array(SceneSchema).min(3),

  music: z.object({
    regenerate: z.boolean().default(DEFAULTS.music.regenerate),
    fallbackDurationSec: z.number().min(10).max(120).default(DEFAULTS.music.fallbackDurationSec),
    styles: z.array(z.string()).default(DEFAULTS.music.styles),
    negativeStyles: z.array(z.string()).default(DEFAULTS.music.negativeStyles),
    sectionStyles: z.record(
      z.enum(["intro", "product", "cta"]),
      z.object({
        positive: z.array(z.string()),
        negative: z.array(z.string()).default([]),
      }),
    ).optional(),
    volume: z.number().min(0).max(1).default(DEFAULTS.music.volume),
  }).default({
    regenerate: DEFAULTS.music.regenerate,
    fallbackDurationSec: DEFAULTS.music.fallbackDurationSec,
    styles: DEFAULTS.music.styles,
    negativeStyles: DEFAULTS.music.negativeStyles,
    volume: DEFAULTS.music.volume,
  }),

  captionStyle: CaptionStyleSchema.default(DEFAULTS.captionStyle),

  branding: z.object({
    logo: z.string(),
    website: z.string(),
  }),
});

// ── Derived TypeScript types ──

export type ReelScenario = z.infer<typeof ReelScenarioSchema>;
export type Scene = z.infer<typeof SceneSchema>;

// ── Word-level timestamps from ElevenLabs ──

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface NarrationTimestamps {
  words: WordTimestamp[];
  totalDuration: number;
}

// ── Audio alignment ──

export function alignScenesToAudio(
  scenes: { scriptSegment: string }[],
  timestamps: NarrationTimestamps,
) {
  const words = timestamps.words;
  let wordCursor = 0;

  return scenes.map((scene) => {
    const segmentWords = scene.scriptSegment
      .replace(/[.,!?;:'"—–\-]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (segmentWords.length === 0 || wordCursor >= words.length) {
      const fallbackStart = wordCursor < words.length ? words[wordCursor].start : timestamps.totalDuration;
      return { sceneStart: fallbackStart, sceneEnd: fallbackStart + 1 };
    }

    const firstTarget = segmentWords[0];
    let matchStart = wordCursor;
    for (let i = wordCursor; i < words.length; i++) {
      const clean = words[i].word.replace(/[.,!?;:'"—–\-]/g, "").toLowerCase();
      if (clean === firstTarget) {
        matchStart = i;
        break;
      }
    }

    const lastTarget = segmentWords[segmentWords.length - 1];
    let matchEnd = matchStart;
    for (let i = matchStart; i < words.length; i++) {
      const clean = words[i].word.replace(/[.,!?;:'"—–\-]/g, "").toLowerCase();
      if (clean === lastTarget && i >= matchStart + segmentWords.length - 2) {
        matchEnd = i;
        break;
      }
    }

    wordCursor = matchEnd + 1;

    return {
      sceneStart: words[matchStart].start,
      sceneEnd: words[matchEnd].end,
    };
  });
}

// ── Helpers ──

import fs from "fs";
import path from "path";

const SCENARIOS_DIR = path.join(process.cwd(), "scenarios");

export function scenarioDir(id: string): string {
  return path.join(SCENARIOS_DIR, id);
}

export function loadScenario(id: string): ReelScenario {
  const filePath = path.join(scenarioDir(id), "scenario.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return ReelScenarioSchema.parse(raw);
}

export function saveScenario(scenario: ReelScenario): void {
  const dir = scenarioDir(scenario.id);
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(dir, "video"), { recursive: true });
  fs.mkdirSync(path.join(dir, "output"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "scenario.json"),
    JSON.stringify(scenario, null, 2),
  );
  console.log(`Scenario saved: ${path.join(dir, "scenario.json")}`);
}

export function loadTimestamps(id: string): NarrationTimestamps {
  const filePath = path.join(scenarioDir(id), "audio", "narration-timestamps.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ── Avatar resolution ──

export interface ResolvedAvatar {
  heygenAvatarId: string;
  voiceId: string;
}

export function resolveAvatarFromScenario(scenario: ReelScenario): ResolvedAvatar {
  const { name, avatarId } = scenario.avatar;

  const entry = AVATAR_LIBRARY[name?.toLowerCase()];
  if (entry) {
    return { heygenAvatarId: entry.heygenAvatarId, voiceId: entry.voiceId };
  }

  if (avatarId) {
    console.warn(`Avatar "${name}" not in library, using raw avatarId. Voice will use .env ELEVENLABS_VOICE_ID.`);
    return {
      heygenAvatarId: avatarId,
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? AVATAR_LIBRARY[DEFAULTS.avatar].voiceId,
    };
  }

  throw new Error(`Cannot resolve avatar: name="${name}", avatarId="${avatarId}". Add it to AVATAR_LIBRARY in config.ts.`);
}
