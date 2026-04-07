/**
 * Split narration audio into segments for avatar scenes.
 *
 * Usage: npx tsx src/pipeline/split-avatar-audio.ts <scenario-id>
 *
 * Uses the SAME cursor-based word matching as assemble.ts alignScenesToAudio
 * to find precise audio boundaries for each avatar scene.
 *
 * Reads: scenarios/{id}/scenario.json
 *        scenarios/{id}/audio/narration.mp3
 *        scenarios/{id}/audio/narration-timestamps.json
 * Writes: scenarios/{id}/audio/avatar-segment-{n}.mp3
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { loadScenario, loadTimestamps, scenarioDir } from "./schema.js";

export async function splitAvatarAudio(scenarioId: string): Promise<string[]> {
  const scenario = loadScenario(scenarioId);
  const timestamps = loadTimestamps(scenarioId);
  const dir = scenarioDir(scenarioId);
  const audioDir = path.join(dir, "audio");
  const narrationPath = path.join(audioDir, "narration.mp3");

  if (!fs.existsSync(narrationPath)) {
    throw new Error(`Narration file not found: ${narrationPath}. Run generate-audio first.`);
  }

  // Use cursor-based matching through ALL scenes (same as alignScenesToAudio)
  // to find precise word boundaries. We process all scenes sequentially
  // but only extract audio for avatar scenes.
  const words = timestamps.words;
  let wordCursor = 0;
  const avatarSegments: { sceneId: string; scriptSegment: string; start: number; end: number }[] = [];

  for (const scene of scenario.scenes) {
    const segmentWords = scene.scriptSegment
      .replace(/[.,!?;:'"—–\-]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (segmentWords.length === 0 || wordCursor >= words.length) {
      continue;
    }

    // Find first word of this segment
    const firstTarget = segmentWords[0];
    let matchStart = wordCursor;
    for (let i = wordCursor; i < words.length; i++) {
      const clean = words[i].word.replace(/[.,!?;:'"—–\-]/g, "").toLowerCase();
      if (clean === firstTarget) {
        matchStart = i;
        break;
      }
    }

    // Find last word of this segment
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

    if (scene.visual === "avatar") {
      avatarSegments.push({
        sceneId: scene.id,
        scriptSegment: scene.scriptSegment,
        start: words[matchStart].start,
        end: words[matchEnd].end,
      });
    }
  }

  console.log(`Found ${avatarSegments.length} avatar scenes to extract\n`);

  const outputFiles: string[] = [];

  for (let i = 0; i < avatarSegments.length; i++) {
    const seg = avatarSegments[i];
    // Small padding for clean cuts
    const segStart = Math.max(0, seg.start - 0.05);
    const segEnd = seg.end + 0.1;
    const duration = segEnd - segStart;

    const outputFile = `avatar-segment-${i}.mp3`;
    const outputPath = path.join(audioDir, outputFile);

    console.log(
      `Scene "${seg.sceneId}" (${segStart.toFixed(2)}s - ${segEnd.toFixed(2)}s, ${duration.toFixed(2)}s)` +
      `\n  Script: "${seg.scriptSegment}"` +
      `\n  Output: ${outputFile}`,
    );

    // Use ffmpeg to extract segment
    execSync(
      `ffmpeg -y -i "${narrationPath}" -ss ${segStart.toFixed(3)} -t ${duration.toFixed(3)} -c copy "${outputPath}"`,
      { stdio: "pipe" },
    );

    outputFiles.push(outputPath);
  }

  console.log(`\nExtracted ${outputFiles.length} avatar audio segments`);
  return outputFiles;
}

// ── CLI (only when run directly) ──
const __isMain = process.argv[1]?.includes("split-avatar-audio");
if (__isMain) {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/split-avatar-audio.ts <scenario-id>");
    process.exit(1);
  }

  splitAvatarAudio(scenarioId)
    .then((files) => {
      console.log("\nAvatar audio segments:", files);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
