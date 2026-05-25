import path from "path";
import { Router, type Request, type Response } from "express";
import { readConfig, readScenarios, readAvatars, pickNextAvatar, updateScenarioStatus, updateConfigValue, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";
import { saveScenario } from "../../pipeline/schema.js";
import { DEFAULTS, AVATAR_LIBRARY, BROLL_MODEL_LIBRARY } from "../../pipeline/config.js";
import { CaptionStyleSchema } from "../../pipeline/schema.js";
import { setTtsReplacements } from "../../pipeline/generate-audio.js";
import { orchestrate } from "../../orchestrate.js";
import { getCostReport } from "../../pipeline/costs.js";
import { uploadToR2 } from "../storage.js";

const router = Router();

// In-memory mutex — only one render at a time
let generating = false;
let generatingId: string | null = null;

export function isGenerating(): boolean {
  return generating;
}

router.post("/generate-reel/:scenarioId", authMiddleware, async (req: Request, res: Response) => {
  const scenarioId = req.params.scenarioId as string;

  if (generating) {
    res.status(409).json({ error: "Already generating", currentId: generatingId });
    return;
  }

  try {
    // Find scenario in Sheet
    const scenarios = await readScenarios();
    const scenario = scenarios.find((s) => s.id === scenarioId);

    if (!scenario) {
      res.status(404).json({ error: `Scenario ${scenarioId} not found` });
      return;
    }

    if (scenario.status !== "approved" && scenario.status !== "generating") {
      res.status(400).json({ error: `Scenario status is "${scenario.status}", expected "approved"` });
      return;
    }

    // Parse the full scenario JSON and add pipeline defaults
    const config = await readConfig();
    const scenarioData = JSON.parse(scenario.scenes_json);
    scenarioData.branding = scenarioData.branding || {
      logo: "logo.svg",
      website: config.website,
    };

    // Apply broll model from Sheet config (validated against BROLL_MODEL_LIBRARY)
    if (config.broll_model) {
      if (!BROLL_MODEL_LIBRARY[config.broll_model]) {
        res.status(400).json({
          error: `Unknown broll_model "${config.broll_model}". Available: ${Object.keys(BROLL_MODEL_LIBRARY).join(", ")}`,
        });
        return;
      }
      DEFAULTS.brollModel = config.broll_model;
    }

    // Apply caption style from Sheet config (validated against CaptionStyleSchema enum)
    if (config.caption_style) {
      const parsed = CaptionStyleSchema.safeParse(config.caption_style);
      if (!parsed.success) {
        res.status(400).json({
          error: `Unknown caption_style "${config.caption_style}". Available: ${CaptionStyleSchema.options.join(", ")}`,
        });
        return;
      }
      (DEFAULTS as { captionStyle: string }).captionStyle = parsed.data;
    }

    // Apply avatar version from Sheet config
    if (config.avatar_version === "V" || config.avatar_version === "IV" || config.avatar_version === "III") {
      DEFAULTS.avatarVersion = config.avatar_version;
    }

    // Parse TTS replacements from Sheet (format: "Go2EV → go to EV" per line)
    if (config.tts_replacements) {
      const replacements: [RegExp, string][] = config.tts_replacements
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const [from, to] = line.split("→").map(s => s.trim());
          return [new RegExp(from, "gi"), to] as [RegExp, string];
        });
      setTtsReplacements(replacements);
    }

    // Avatar rotation — load from Sheet and pick next
    const avatars = await readAvatars();
    if (avatars.length > 0) {
      // Sync Sheet avatars into pipeline's AVATAR_LIBRARY
      for (const a of avatars) {
        AVATAR_LIBRARY[a.name.toLowerCase()] = {
          heygenAvatarId: a.heygenAvatarId,
          voiceId: a.voiceId,
          description: a.description,
        };
      }
      const lastUsed = config.last_avatar_used || "";
      const activeNames = avatars.filter(a => a.active).map(a => a.name);
      if (lastUsed && !activeNames.includes(lastUsed)) {
        console.log(`  last_avatar_used="${lastUsed}" not in active list — restarting rotation`);
      }
      const avatar = pickNextAvatar(avatars, lastUsed);
      scenarioData.avatar = { name: avatar.name, avatarId: avatar.heygenAvatarId };
      // Override voice in DEFAULTS for TTS
      DEFAULTS.avatar = avatar.name;
      console.log(`  Avatar: ${avatar.name} (${avatar.description})`);
      await updateConfigValue("last_avatar_used", avatar.name);
    }

    // Save scenario.json to disk (pipeline expects it there)
    saveScenario(scenarioData);

    // Update status
    await updateScenarioStatus(scenarioId, { status: "generating" });
    generating = true;
    generatingId = scenarioId;

    // Respond immediately
    res.json({ status: "generating", scenarioId });

    // Run pipeline in background
    runPipeline(scenarioId, scenarioData.id, scenario.title, config.alert_email || "").catch(() => {});

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Read scenario row by ID (used by n8n before YouTube upload to fetch generated description)
router.get("/scenario/:scenarioId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const scenarios = await readScenarios();
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      res.status(404).json({ error: `Scenario ${scenarioId} not found` });
      return;
    }
    res.json({
      id: scenario.id,
      title: scenario.title,
      reel_url: scenario.reel_url,
      yt_description: scenario.yt_description,
      meta_caption: scenario.meta_caption,
      status: scenario.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Update scenario status (used by n8n)
router.post("/update-status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { scenarioId, status, publish_urls } = req.body;
    if (!scenarioId || !status) {
      res.status(400).json({ error: "scenarioId and status required" });
      return;
    }
    const updates: Record<string, unknown> = { status };
    if (publish_urls) updates.publish_urls = publish_urls;
    if (status === "published") updates.published_at = new Date().toISOString();
    await updateScenarioStatus(scenarioId, updates as any);
    await appendLog({ action: "status-update", scenario_id: scenarioId, message: `Status → ${status}` });
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

async function runPipeline(sheetId: string, pipelineId: string, title: string, alertEmail: string): Promise<void> {
  try {
    console.log(`\nStarting pipeline for "${pipelineId}" (sheet row: ${sheetId})...`);

    const outputPath = await orchestrate(pipelineId);

    // Read cost from pipeline output
    let totalCost = 0;
    try {
      const report = getCostReport(pipelineId);
      totalCost = report.total;
    } catch {}

    // Upload to R2 if configured
    let reelUrl = outputPath;
    let uploadedToR2 = false;
    if (process.env.R2_ACCESS_KEY_ID) {
      try {
        const date = new Date().toISOString().slice(0, 10);
        const remoteName = `reels/${date}-${pipelineId}.mp4`;
        reelUrl = await uploadToR2(outputPath, remoteName);
        uploadedToR2 = true;
      } catch (err) {
        console.warn(`  ⚠ R2 upload failed, using local path: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Generate YT description + Meta caption (PRZED cleanupem — czyta scenario.json z lokalnego dysku)
    let ytDescription = "";
    let metaCaption = "";
    try {
      const { generateDescriptionAndCaption } = await import("../../scenario/generate-description.js");
      const { loadScenario } = await import("../../pipeline/schema.js");
      const finalScenario = loadScenario(pipelineId);
      const config = await readConfig();
      const descResult = await generateDescriptionAndCaption(finalScenario, config, pipelineId);
      ytDescription = descResult.yt_description;
      metaCaption = descResult.meta_caption;
      totalCost += descResult.cost;
    } catch (err) {
      console.warn(`  ⚠ Description generation failed: ${err instanceof Error ? err.message : err}`);
      ytDescription = `${title}\n\n#shorts`;
      metaCaption = title;
    }

    // Cleanup local files after successful R2 upload
    if (uploadedToR2) {
      try {
        const scenarioPath = path.join(process.cwd(), "scenarios", pipelineId);
        const { rmSync } = await import("fs");
        rmSync(scenarioPath, { recursive: true, force: true });
        console.log(`  Cleaned up: ${scenarioPath}`);
      } catch (err) {
        console.warn(`  ⚠ Cleanup failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    await updateScenarioStatus(sheetId, {
      status: "ready_for_review",
      reel_url: reelUrl,
      cost: totalCost,
      generated_at: new Date().toISOString(),
      error: "",
      yt_description: ytDescription,
      meta_caption: metaCaption,
    });

    await appendLog({
      action: "generate-reel",
      scenario_id: sheetId,
      message: `Pipeline complete. Output: ${reelUrl}. Cost: $${totalCost.toFixed(4)}`,
      cost: totalCost,
    });

    console.log(`✓ Pipeline complete for "${pipelineId}"`);

    // Notify n8n
    await notifyN8n("reel_complete", { scenarioId: sheetId, pipelineId, title, reelUrl, cost: totalCost, alertEmail });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : "";
    console.error(`✗ Pipeline failed for "${pipelineId}": ${message}`);
    if (stack) console.error(`  Stack: ${stack}`);

    const errorForSheet = `[${new Date().toISOString()}] ${message}`.substring(0, 1000);
    await updateScenarioStatus(sheetId, {
      status: "approved",
      error: errorForSheet,
    }).catch(() => {});

    await appendLog({
      action: "error",
      scenario_id: sheetId,
      message: `Pipeline failed: ${message.substring(0, 1000)}`,
    }).catch(() => {});

    await notifyN8n("reel_failed", { scenarioId: sheetId, pipelineId, title, error: message.substring(0, 500), alertEmail });

  } finally {
    generating = false;
    generatingId = null;
  }
}

async function notifyN8n(event: string, data: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...data }),
    });
    console.log(`  n8n notified: ${event}`);
  } catch (err) {
    console.warn(`  ⚠ n8n webhook failed: ${err instanceof Error ? err.message : err}`);
  }
}

export default router;
