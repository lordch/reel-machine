/**
 * Generate AI b-roll videos via fal.ai (Kling 3.0 Standard).
 *
 * Usage: npx tsx src/pipeline/fetch-broll.ts <scenario-id>
 *
 * Reads: scenarios/{id}/scenario.json
 * Writes: scenarios/{id}/video/broll-{n}.mp4
 *
 * All clips generated in parallel. Retries up to 3 times on failure.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { loadScenario, loadTimestamps, alignScenesToAudio, scenarioDir } from "./schema.js";
import { DEFAULTS, resolveBrollModel } from "./config.js";
import { addCost } from "./costs.js";

const FAL_KEY = process.env.FAL_KEY;

/**
 * Trim video to target duration using ffmpeg.
 * Also scales to 1080x1920 if needed.
 */
function trimAndScale(inputPath: string, outputPath: string, duration: number): void {
  execSync(
    `ffmpeg -y -i "${inputPath}" ` +
    `-t ${duration.toFixed(3)} ` +
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
    `-c:v libx264 -preset fast -crf 23 ` +
    `-an "${outputPath}"`,
    { stdio: "pipe" },
  );
}

/**
 * Generate a video clip using fal.ai.
 * Model resolved from BROLL_MODEL_LIBRARY via DEFAULTS.brollModel.
 */
async function generateAiVideo(prompt: string, outputPath: string, duration: number): Promise<void> {
  if (!FAL_KEY) throw new Error("FAL_KEY not set — cannot generate AI video");

  const model = resolveBrollModel(DEFAULTS.brollModel);
  const ceiled = Math.max(model.minDuration, Math.min(Math.ceil(duration), model.maxDuration));
  const clampedDuration = model.validDurations
    ? (model.validDurations.filter(d => d >= ceiled)[0] ?? Math.max(...model.validDurations))
    : ceiled;

  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: FAL_KEY });

  console.log(`  AI [${DEFAULTS.brollModel}] generating: "${prompt.slice(0, 80)}..."`);

  let result: any;
  try {
    result = await fal.subscribe(model.falEndpoint, {
      input: {
        prompt,
        duration: model.durationFormat === "with_s" ? `${clampedDuration}s` : String(clampedDuration),
        aspect_ratio: "9:16",
        negative_prompt: DEFAULTS.brollNegativePrompt,
        ...(model.extraParams || {}),
      },
      logs: true,
      onQueueUpdate: (update: any) => {
        if (update.status === "IN_PROGRESS" && update.logs?.length > 0) {
          process.stdout.write(".");
        }
      },
    });
  } catch (err: any) {
    const detail = err.body ?? err.message ?? String(err);
    throw new Error(`fal.ai [${DEFAULTS.brollModel}] error: ${typeof detail === "object" ? JSON.stringify(detail) : detail}`);
  }

  const videoUrl = result.data?.video?.url || result.video?.url;
  if (!videoUrl) {
    throw new Error(`No video URL in fal response: ${JSON.stringify(result).slice(0, 200)}`);
  }

  console.log(`\n  AI video generated, downloading...`);
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download AI video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`  AI video: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
}

export async function fetchBroll(scenarioId: string): Promise<string[]> {
  const scenario = loadScenario(scenarioId);
  const dir = scenarioDir(scenarioId);
  const videoDir = path.join(dir, "video");
  fs.mkdirSync(videoDir, { recursive: true });

  // Compute real scene durations from audio timestamps (if available)
  const timestampsPath = path.join(dir, "audio", "narration-timestamps.json");
  const hasTimestamps = fs.existsSync(timestampsPath);
  const timestamps = hasTimestamps ? loadTimestamps(scenarioId) : null;
  const aligned = timestamps ? alignScenesToAudio(scenario.scenes, timestamps) : null;

  if (hasTimestamps) {
    console.log("Using audio-aligned durations (from narration timestamps)\n");
  } else {
    console.log("⚠ No narration timestamps found — using fallback duration (run audio step first for accurate durations)\n");
  }

  // Fallback duration when no timestamps: divide target evenly across scenes
  const fallbackDuration = Math.max(3, scenario.meta.targetDuration / scenario.scenes.length);

  const brollScenes = scenario.scenes
    .map((s, i) => ({ scene: s, sceneIndex: i }))
    .filter(({ scene }) => scene.visual === "broll");
  console.log(`Generating ${brollScenes.length} AI b-roll clips in parallel...\n`);

  const jobs = brollScenes.map(async ({ scene, sceneIndex }, index) => {
    let duration: number;
    if (aligned && timestamps) {
      // B-roll slot absorbs gap from previous avatar scene:
      // starts at prev avatar's speechEnd, ends at next scene's sceneStart
      const timing = aligned[sceneIndex];
      const prevScene = sceneIndex > 0 ? scenario.scenes[sceneIndex - 1] : null;
      const prevTiming = sceneIndex > 0 ? aligned[sceneIndex - 1] : null;
      const slotStart = (prevScene?.visual === "avatar" && prevTiming)
        ? Math.min(prevTiming.sceneEnd, timing.sceneStart)  // absorb avatar gap
        : timing.sceneStart;
      const slotEnd = sceneIndex + 1 < aligned.length
        ? aligned[sceneIndex + 1].sceneStart
        : timestamps.totalDuration;
      duration = Math.max(0.5, slotEnd - slotStart);
    } else {
      duration = fallbackDuration;
    }
    const outputPath = path.join(videoDir, `broll-${index}.mp4`);
    const rawPath = path.join(videoDir, `broll-${index}-raw.mp4`);
    const aiPrompt = scene.brollAiPrompt || scene.brollQuery || scene.scriptSegment;

    console.log(`B-roll ${index}: "${scene.id}" (${duration.toFixed(1)}s) — AI generating...`);
    await generateAiVideo(aiPrompt, rawPath, duration);
    trimAndScale(rawPath, outputPath, duration);
    fs.unlinkSync(rawPath);
    console.log(`B-roll ${index}: "${scene.id}" — done!`);
    return outputPath;
  });

  const outputFiles = await Promise.all(jobs);

  // Cost tracking — measure actual durations from rendered clips
  const model = resolveBrollModel(DEFAULTS.brollModel);
  let totalSec = 0;
  for (const f of outputFiles) {
    try {
      const dur = parseFloat(execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${f}"`, { encoding: "utf-8" }).trim());
      totalSec += dur;
    } catch { /* skip */ }
  }
  const cost = totalSec * model.costPerSec;
  addCost(scenarioId, { step: "broll", provider: "fal.ai", detail: `${outputFiles.length} clips, ${DEFAULTS.brollModel}, ${totalSec.toFixed(1)}s total`, cost });

  console.log(`\nGenerated ${outputFiles.length} AI b-roll clips (parallel)`);
  return outputFiles;
}

// ── CLI (only when run directly) ──
const __isMain = process.argv[1]?.includes("fetch-broll");
if (__isMain) {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/fetch-broll.ts <scenario-id> [--model=<model-id>]");
    process.exit(1);
  }

  const modelArg = process.argv.slice(3).find(a => a.startsWith("--model="));
  if (modelArg) DEFAULTS.brollModel = modelArg.split("=")[1];

  fetchBroll(scenarioId)
    .then((files) => {
      console.log("\nB-roll clips:", files);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
