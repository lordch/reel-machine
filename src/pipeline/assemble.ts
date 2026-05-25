/**
 * Assemble all generated assets into a Remotion composition and render.
 *
 * Usage: npx tsx src/pipeline/assemble.ts <scenario-id> [--render]
 *
 * Key behavior:
 * - Video duration = audio duration (not scenario targetDuration)
 * - Captions are word-by-word from ElevenLabs timestamps (exact sync)
 * - Scene boundaries are aligned to actual audio word timing
 * - B-roll clips are re-trimmed to match aligned durations
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync, type ExecSyncOptions } from "child_process";
import { loadScenario, loadTimestamps, alignScenesToAudio, scenarioDir, type NarrationTimestamps } from "./schema.js";

function runCommand(cmd: string, label: string, opts: ExecSyncOptions = { stdio: "pipe" }): void {
  try {
    execSync(cmd, opts);
  } catch (err: any) {
    const stderr = err.stderr?.toString()?.slice(-500) || "";
    throw new Error(`${label} failed: ${err.message}${stderr ? `\nffmpeg output: ${stderr}` : ""}`);
  }
}
import type { CaptionSegment, ClipInfo, ReelProps } from "../types.js";

const FPS = 30;
const PUBLIC_DIR = path.join(process.cwd(), "public", "generated");

function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FPS);
}


/**
 * Build word-synced captions from ElevenLabs timestamps.
 */
function buildWordCaptions(timestamps: NarrationTimestamps): CaptionSegment[] {
  const words = timestamps.words;
  const MAX_WORDS = 5;
  const MIN_WORDS = 2;
  const PAUSE_THRESHOLD = 0.25;

  const breakAfter = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isLast = i === words.length - 1;

    if (isLast) {
      breakAfter.add(i);
      continue;
    }

    const endsSentence = /[.!?]$/.test(word.word);
    const endsClause = /[,;:]$/.test(word.word);
    const hasLongPause = (words[i + 1].start - word.end) > PAUSE_THRESHOLD;

    if (endsSentence || endsClause || hasLongPause) {
      breakAfter.add(i);
    }
  }

  const rawGroups: { start: number; end: number }[] = [];
  let groupStart = 0;
  for (let i = 0; i < words.length; i++) {
    if (breakAfter.has(i)) {
      rawGroups.push({ start: groupStart, end: i });
      groupStart = i + 1;
    }
  }

  const mergedGroups: { start: number; end: number }[] = [];
  for (const group of rawGroups) {
    const len = group.end - group.start + 1;
    if (len < MIN_WORDS && mergedGroups.length > 0) {
      mergedGroups[mergedGroups.length - 1].end = group.end;
    } else {
      mergedGroups.push({ ...group });
    }
  }

  const finalGroups: { start: number; end: number }[] = [];
  for (const group of mergedGroups) {
    const len = group.end - group.start + 1;
    if (len <= MAX_WORDS) {
      finalGroups.push(group);
    } else {
      let s = group.start;
      while (s <= group.end) {
        const remaining = group.end - s + 1;
        const chunkSize = remaining <= MAX_WORDS + MIN_WORDS
          ? remaining
          : MAX_WORDS;
        finalGroups.push({ start: s, end: Math.min(s + chunkSize - 1, group.end) });
        s += chunkSize;
      }
    }
  }

  const captions: CaptionSegment[] = [];
  for (let g = 0; g < finalGroups.length; g++) {
    const group = finalGroups[g];
    const groupWords = words.slice(group.start, group.end + 1);
    const text = groupWords.map((w) => w.word).join(" ");
    const startTime = groupWords[0].start;
    const endTime = groupWords[groupWords.length - 1].end;

    const nextStart = g + 1 < finalGroups.length
      ? words[finalGroups[g + 1].start].start
      : endTime + 0.5;
    const paddedEnd = Math.min(endTime + 0.1, nextStart);

    captions.push({
      text,
      startFrame: secondsToFrames(startTime),
      endFrame: secondsToFrames(paddedEnd),
      position: "bottom-center",
      animation: "pop",
      fontSize: 64,
      color: "#FFFFFF",
    });
  }

  return captions;
}

export async function assemble(scenarioId: string, shouldRender = false): Promise<void> {
  const scenario = loadScenario(scenarioId);
  const timestamps = loadTimestamps(scenarioId);
  const dir = scenarioDir(scenarioId);

  const totalDuration = timestamps.totalDuration;
  const durationInFrames = secondsToFrames(totalDuration);

  console.log(`Assembling: "${scenario.meta.title}"`);
  console.log(`Audio duration: ${totalDuration.toFixed(1)}s → ${durationInFrames} frames @ ${FPS}fps\n`);

  // Clean public/generated
  if (fs.existsSync(PUBLIC_DIR)) {
    for (const f of fs.readdirSync(PUBLIC_DIR)) {
      if (f.startsWith("gen-") || f === "narration.mp3" || f === "music.mp3") {
        fs.unlinkSync(path.join(PUBLIC_DIR, f));
      }
    }
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // ── 1. Align scenes to actual audio ──
  const aligned = alignScenesToAudio(scenario.scenes, timestamps);

  console.log("Scene alignment (scenario → audio):");
  scenario.scenes.forEach((scene, i) => {
    const t = aligned[i];
    console.log(
      `  ${scene.id}: → ${t.sceneStart.toFixed(2)}-${t.sceneEnd.toFixed(2)}s (${(t.sceneEnd - t.sceneStart).toFixed(2)}s) [${scene.visual}]`,
    );
  });

  // ── 2. Collect MUTE video clips ──
  const clips: ClipInfo[] = [];
  let avatarIndex = 0;
  let brollIndex = 0;

  const slots: { start: number; duration: number }[] = [];
  for (let i = 0; i < scenario.scenes.length; i++) {
    const timing = aligned[i];
    const scene = scenario.scenes[i];
    const speechDuration = Math.max(0.5, timing.sceneEnd - timing.sceneStart);

    if (scene.visual === "avatar") {
      slots.push({ start: timing.sceneStart, duration: speechDuration });
    } else {
      const prevEnd = i > 0 ? slots[i - 1].start + slots[i - 1].duration : timing.sceneStart;
      const slotStart = Math.min(prevEnd, timing.sceneStart);
      const slotEnd = i + 1 < aligned.length ? aligned[i + 1].sceneStart : totalDuration;
      slots.push({ start: slotStart, duration: Math.max(0.5, slotEnd - slotStart) });
    }
  }

  for (let i = 0; i < scenario.scenes.length; i++) {
    const scene = scenario.scenes[i];
    const slot = slots[i];
    const clipDuration = slot.duration;
    const clipFrames = secondsToFrames(clipDuration);

    let sourceFile: string;
    let destFile: string;

    if (scene.visual === "avatar") {
      sourceFile = path.join(dir, "video", `avatar-${avatarIndex}.mp4`);
      destFile = `gen-avatar-${avatarIndex}.mp4`;
      avatarIndex++;
    } else if (scene.visual === "broll") {
      sourceFile = path.join(dir, "video", `broll-${brollIndex}.mp4`);
      destFile = `gen-broll-${brollIndex}.mp4`;
      brollIndex++;
    } else {
      // Screenshot — resolve from repo assets dir
      const assetName = scene.screenshotAsset || "placeholder.png";
      sourceFile = path.join(process.cwd(), "assets", assetName);
      destFile = `gen-screenshot-${assetName}`;
    }

    const destPath = path.join(PUBLIC_DIR, destFile);

    if (!fs.existsSync(sourceFile)) {
      console.warn(`  ⚠ ${sourceFile} not found → placeholder`);
      runCommand(
        `ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:d=${clipDuration.toFixed(2)} ` +
        `-an -c:v libx264 -preset ultrafast "${destPath}"`,
        `placeholder for ${scene.id}`,
      );
    } else if (scene.visual === "avatar") {
      runCommand(
        `ffmpeg -y -i "${sourceFile}" -an ` +
        `-t ${clipDuration.toFixed(3)} -c:v libx264 -preset fast -crf 23 "${destPath}"`,
        `encode avatar ${scene.id}`,
      );
    } else if (scene.visual === "broll") {
      runCommand(
        `ffmpeg -y -i "${sourceFile}" -an ` +
        `-t ${clipDuration.toFixed(3)} ` +
        `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
        `-c:v libx264 -preset fast -crf 23 "${destPath}"`,
        `encode broll ${scene.id}`,
      );
    } else {
      runCommand(
        `ffmpeg -y -loop 1 -i "${sourceFile}" -an ` +
        `-t ${clipDuration.toFixed(3)} ` +
        `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
        `-c:v libx264 -preset fast -crf 23 "${destPath}"`,
        `encode screenshot ${scene.id}`,
      );
    }

    clips.push({
      src: `generated/${destFile}`,
      durationInFrames: clipFrames,
      videoDurationInFrames: clipFrames,
      sceneType: scene.visual as "avatar" | "broll" | "screenshot",
    });
    console.log(`  ${destFile} (${clipDuration.toFixed(2)}s → ${clipFrames}f) [${scene.visual}]`);
  }

  // ── 3. Copy audio assets ──
  const narrationSrcPath = path.join(dir, "audio", "narration.mp3");
  const narrationDest = "generated/narration.mp3";
  fs.copyFileSync(narrationSrcPath, path.join(PUBLIC_DIR, "narration.mp3"));
  console.log(`  narration.mp3 (master audio)`);

  const musicSrc = path.join(dir, "audio", "music.mp3");
  const musicDest = "generated/music.mp3";
  let hasMusic = false;
  if (fs.existsSync(musicSrc)) {
    fs.copyFileSync(musicSrc, path.join(PUBLIC_DIR, "music.mp3"));
    hasMusic = true;
    console.log(`  music.mp3`);
  }

  // ── 4. Build word-synced captions ──
  const captions = buildWordCaptions(timestamps);
  console.log(`\nCaptions: ${captions.length} groups from ${timestamps.words.length} words`);
  captions.forEach((c) => {
    console.log(`  [${(c.startFrame / FPS).toFixed(2)}-${(c.endFrame / FPS).toFixed(2)}s] "${c.text}"`);
  });

  // ── 4b. Build scene overlays ──
  const sceneOverlays: { overlay: NonNullable<typeof scenario.scenes[0]["overlay"]>; startFrame: number; durationInFrames: number }[] = [];
  for (let i = 0; i < scenario.scenes.length; i++) {
    const scene = scenario.scenes[i];
    if (!scene.overlay) continue;
    const timing = aligned[i];
    const dur = Math.max(0.5, timing.sceneEnd - timing.sceneStart);
    sceneOverlays.push({
      overlay: scene.overlay,
      startFrame: secondsToFrames(timing.sceneStart),
      durationInFrames: secondsToFrames(dur),
    });
  }
  console.log(`\nScene overlays: ${sceneOverlays.length}`);

  // ── 5. Build ReelProps ──
  const reelProps: ReelProps & { narrationSrc: string; musicSrc?: string } = {
    clips,
    captions,
    captionStyle: scenario.captionStyle,
    branding: scenario.branding,
    fps: FPS,
    durationInFrames,
    sceneOverlays,
    narrationSrc: narrationDest,
    ...(hasMusic ? { musicSrc: musicDest } : {}),
  };

  // ── 6. Write data file ──
  const dataFileContent = `// Auto-generated by assemble.ts — do not edit manually
import type { ReelProps } from "../types";

export const generatedReelProps: ReelProps & { narrationSrc: string; musicSrc?: string } = ${JSON.stringify(reelProps, null, 2)};
`;

  const dataFilePath = path.join(process.cwd(), "src", "data", "generated-reel.ts");
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(dataFilePath, dataFileContent);
  console.log(`\nData: ${dataFilePath}`);
  console.log(`Duration: ${totalDuration.toFixed(1)}s | Clips: ${clips.length} | Captions: ${captions.length}`);

  // ── 7. Render ──
  if (shouldRender) {
    const outputPath = path.join(dir, "output", "reel.mp4");
    fs.mkdirSync(path.join(dir, "output"), { recursive: true });
    console.log(`\nRendering → ${outputPath}`);
    runCommand(
      `npx remotion render src/index.ts GeneratedReel "${outputPath}"`,
      "Remotion render",
      { stdio: "inherit", cwd: process.cwd() },
    );
    console.log(`Done: ${outputPath}`);
  } else {
    console.log("\nRun with --render or:");
    console.log(`  npx remotion render src/index.ts GeneratedReel scenarios/${scenarioId}/output/reel.mp4`);
  }
}

// ── CLI (only when run directly) ──
const __isMain = process.argv[1]?.includes("assemble");
if (__isMain) {
  const scenarioId = process.argv[2];
  const shouldRender = process.argv.includes("--render");

  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/assemble.ts <scenario-id> [--render]");
    process.exit(1);
  }

  assemble(scenarioId, shouldRender)
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
