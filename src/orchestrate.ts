/**
 * Orchestrate full pipeline: audio → split → avatar+broll+music (parallel) → assemble+render.
 *
 * Usage: npx tsx src/orchestrate.ts <scenario-id> [--product=<id>] [--no-render]
 *
 * All steps have automatic retry with exponential backoff.
 */

import "dotenv/config";
import path from "path";
import { withRetry } from "./pipeline/retry.js";
import { generateAudio } from "./pipeline/generate-audio.js";
import { splitAvatarAudio } from "./pipeline/split-avatar-audio.js";
import { generateAvatar } from "./pipeline/generate-avatar.js";
import { fetchBroll } from "./pipeline/fetch-broll.js";
import { generateMusic } from "./pipeline/generate-music.js";
import { assemble } from "./pipeline/assemble.js";
import { printCostSummary } from "./pipeline/costs.js";

async function orchestrate(scenarioId: string, productId?: string, shouldRender = true): Promise<string> {
  const startTime = Date.now();
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Reel Machine — Orchestrating: ${scenarioId}`);
  if (productId) console.log(`  Product: ${productId}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Generate narration audio
  console.log("\n── Step 1/6: Generate Audio ──\n");
  await withRetry(() => generateAudio(scenarioId, productId), 3, "audio");

  // 2. Split into avatar segments
  console.log("\n── Step 2/6: Split Avatar Audio ──\n");
  await withRetry(() => splitAvatarAudio(scenarioId), 3, "split");

  // 3. Parallel: avatar + broll + music
  console.log("\n── Steps 3-5/6: Avatar + B-Roll + Music (parallel) ──\n");
  const [avatarFiles, brollFiles, musicFile] = await Promise.all([
    withRetry(() => generateAvatar(scenarioId), 3, "avatar"),
    withRetry(() => fetchBroll(scenarioId), 3, "broll"),
    withRetry(() => generateMusic(scenarioId), 2, "music"),
  ]);

  console.log(`\nParallel steps complete:`);
  console.log(`  Avatar: ${avatarFiles.length} clips`);
  console.log(`  B-Roll: ${brollFiles.length} clips`);
  console.log(`  Music: ${musicFile ? "yes" : "no"}`);

  // 4. Assemble + render
  console.log("\n── Step 6/6: Assemble" + (shouldRender ? " + Render" : "") + " ──\n");
  await withRetry(() => assemble(scenarioId, shouldRender, productId), 2, "assemble");

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Pipeline complete in ${elapsed}s`);
  printCostSummary(scenarioId);
  console.log(`${"═".repeat(60)}\n`);

  const outputPath = path.join(process.cwd(), "scenarios", scenarioId, "output", "reel.mp4");
  return outputPath;
}

// ── CLI ──
const scenarioId = process.argv[2];
const productFlag = process.argv.find(a => a.startsWith("--product="));
const productId = productFlag?.split("=")[1];
const noRender = process.argv.includes("--no-render");

if (!scenarioId) {
  console.error("Usage: npx tsx src/orchestrate.ts <scenario-id> [--product=<id>] [--no-render]");
  process.exit(1);
}

orchestrate(scenarioId, productId, !noRender)
  .then((outputPath) => {
    console.log(`Output: ${outputPath}`);
  })
  .catch((err) => {
    console.error(`\nPipeline FAILED: ${err.message}`);
    process.exit(1);
  });
