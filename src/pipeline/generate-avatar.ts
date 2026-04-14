/**
 * Generate avatar videos via HeyGen API.
 *
 * Usage: npx tsx src/pipeline/generate-avatar.ts <scenario-id>
 *
 * Reads: scenarios/{id}/scenario.json
 *        scenarios/{id}/audio/avatar-segment-{n}.mp3
 * Writes: scenarios/{id}/video/avatar-{n}.mp4
 *
 * HeyGen flow:
 * 1. Upload each audio segment
 * 2. Create video generation tasks (avatar + audio)
 * 3. Poll until complete
 * 4. Download results
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { loadScenario, resolveAvatarFromScenario, scenarioDir, type ReelScenario } from "./schema.js";
import { DEFAULTS, PRICING } from "./config.js";
import { addCost } from "./costs.js";

const API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = "https://api.heygen.com";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 min max

interface HeyGenVideoStatus {
  code: number;
  data: {
    video_id: string;
    status: "processing" | "completed" | "failed";
    video_url?: string;
    error?: unknown;
  };
}

async function heygenFetch(endpoint: string, opts: RequestInit = {}): Promise<any> {
  if (!API_KEY) throw new Error("HEYGEN_API_KEY not set in environment");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...opts,
    headers: {
      "X-Api-Key": API_KEY,
      ...opts.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const isBilling = res.status === 402 || body.includes("insufficient") || body.includes("credit") || body.includes("quota") || body.includes("balance");
    throw new Error(`HeyGen API error ${res.status}: ${body.substring(0, 300)}${isBilling ? " — CHECK ACCOUNT BALANCE / CREDITS" : ""}`);
  }

  return res.json();
}

/**
 * Upload an audio file to HeyGen and get an asset ID.
 * Note: uploads go to upload.heygen.com, not api.heygen.com
 */
async function uploadAudio(filePath: string): Promise<string> {
  if (!API_KEY) throw new Error("HEYGEN_API_KEY not set in environment");

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const res = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "X-Api-Key": API_KEY,
      "Content-Type": "audio/mpeg",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HeyGen upload error ${res.status}: ${body}`);
  }

  const result = await res.json() as any;
  const assetId = result.data?.id;

  if (!assetId) {
    throw new Error(`No asset ID in upload response: ${JSON.stringify(result)}`);
  }

  console.log(`  Uploaded: ${fileName} → asset_id: ${assetId}`);
  return assetId;
}

/**
 * Create avatar video from audio asset.
 * Routes to Avatar III (/v2/video/generate) or Avatar IV (/v2/video/av4/generate)
 * based on DEFAULTS.avatarVersion.
 */
async function createAvatarVideo(audioAssetId: string, avatar: ReelScenario["avatar"], resolvedAvatarId: string): Promise<string> {
  const version = DEFAULTS.avatarVersion;

  const background: Record<string, any> = avatar.circleBackgroundColor
    ? { type: "color", value: avatar.circleBackgroundColor }
    : { type: "color", value: "#000000" };

  let data: any;

  if (version === "IV") {
    // Avatar IV — dedicated endpoint, simpler payload
    const body: Record<string, any> = {
      avatar_id: resolvedAvatarId,
      voice: {
        type: "audio",
        audio_asset_id: audioAssetId,
      },
      dimension: { width: 1080, height: 1920 },
    };
    const res = await heygenFetch("/v2/video/av4/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = res.data;
  } else {
    // Avatar III — classic endpoint
    const character: Record<string, any> = {
      type: "avatar",
      avatar_id: resolvedAvatarId,
      avatar_style: avatar.avatarStyle ?? "normal",
      talking_style: avatar.talkingStyle,
      expression: avatar.expression,
      matting: avatar.matting,
    };

    if (avatar.offset) {
      character.offset = avatar.offset;
    }

    const res = await heygenFetch("/v2/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs: [
          {
            character,
            voice: {
              type: "audio",
              audio_asset_id: audioAssetId,
            },
            background,
          },
        ],
        dimension: { width: 1080, height: 1920 },
        aspect_ratio: "9:16",
      }),
    });
    data = res.data;
  }

  console.log(`  Video task created [Avatar ${version}]: ${data.video_id}`);
  return data.video_id;
}

/**
 * Poll for video completion and return download URL.
 */
async function pollVideoStatus(videoId: string): Promise<string> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const result = (await heygenFetch(`/v1/video_status.get?video_id=${videoId}`)) as HeyGenVideoStatus;
    const { status, video_url, error } = result.data;

    if (status === "completed" && video_url) {
      return video_url;
    }

    if (status === "failed") {
      const errorDetail = typeof error === "object" ? JSON.stringify(error) : (error || "unknown error");
      throw new Error(`HeyGen video generation failed: ${errorDetail}`);
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`HeyGen video generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

/**
 * Download video file from URL.
 */
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download video: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Downloaded: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
}

export async function generateAvatar(scenarioId: string, avatarIdOverride?: string): Promise<string[]> {
  const scenario = loadScenario(scenarioId);
  const avatar = { ...scenario.avatar };
  const resolved = resolveAvatarFromScenario(scenario);
  const heygenAvatarId = avatarIdOverride ?? resolved.heygenAvatarId;

  const dir = scenarioDir(scenarioId);
  const audioDir = path.join(dir, "audio");
  const videoDir = path.join(dir, "video");
  fs.mkdirSync(videoDir, { recursive: true });

  const avatarScenes = scenario.scenes.filter((s) => s.visual === "avatar");
  console.log(`Generating ${avatarScenes.length} avatar videos [Avatar ${DEFAULTS.avatarVersion}] (avatar: ${avatar.name} → ${heygenAvatarId}, style: ${avatar.talkingStyle}, matting: ${avatar.matting})...\n`);

  // Upload all audio segments and create video tasks in parallel
  const jobs = avatarScenes.map(async (scene, i) => {
    const segmentPath = path.join(audioDir, `avatar-segment-${i}.mp3`);
    if (!fs.existsSync(segmentPath)) {
      throw new Error(`Audio segment not found: ${segmentPath}. Run split-avatar-audio first.`);
    }

    const outputPath = path.join(videoDir, `avatar-${i}.mp4`);
    console.log(`Avatar ${i}: "${scene.id}" — uploading audio...`);

    // 1. Upload audio
    const assetId = await uploadAudio(segmentPath);

    // 2. Create video task
    const videoId = await createAvatarVideo(assetId, avatar, heygenAvatarId);

    // 3. Poll for completion
    console.log(`Avatar ${i}: "${scene.id}" — rendering...`);
    const videoUrl = await pollVideoStatus(videoId);
    console.log(`Avatar ${i}: "${scene.id}" — done!`);

    // 4. Download
    await downloadVideo(videoUrl, outputPath);
    return outputPath;
  });

  const outputFiles = await Promise.all(jobs);

  // Measure total duration for cost tracking
  const { execSync } = await import("child_process");
  let totalSec = 0;
  for (const f of outputFiles) {
    try {
      const dur = parseFloat(execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${f}"`, { encoding: "utf-8" }).trim());
      totalSec += dur;
    } catch { /* skip */ }
  }

  const pricePerSec = DEFAULTS.avatarVersion === "IV" ? PRICING.heygenAvatarIVPerSec : PRICING.heygenAvatarIIIPerSec;
  const cost = totalSec * pricePerSec;
  addCost(scenarioId, { step: "avatar", provider: "heygen", detail: `${outputFiles.length} clips, ${totalSec.toFixed(1)}s total, Avatar ${DEFAULTS.avatarVersion}`, cost });

  console.log(`\nGenerated ${outputFiles.length} avatar videos (parallel)`);
  return outputFiles;
}

// ── CLI (only when run directly) ──
const __isMain = process.argv[1]?.includes("generate-avatar");
if (__isMain) {
  const scenarioId = process.argv[2];
  const avatarFlag = process.argv.find(a => a.startsWith("--avatar="));
  const cliAvatarId = avatarFlag?.split("=")[1];

  if (!scenarioId) {
    console.error("Usage: npx tsx src/pipeline/generate-avatar.ts <scenario-id> [--avatar=AVATAR_ID]");
    process.exit(1);
  }

  generateAvatar(scenarioId, cliAvatarId)
    .then((files) => {
      console.log("\nAvatar videos:", files);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
