import path from "path";
import { Router, type Request, type Response } from "express";
import { readConfig, readScenarios, updateScenarioStatus, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";
import { saveScenario } from "../../pipeline/schema.js";
import { DEFAULTS } from "../../pipeline/config.js";
import { setTtsReplacements } from "../../pipeline/generate-audio.js";
import { orchestrate } from "../../orchestrate.js";
import { getCostReport } from "../../pipeline/costs.js";
import { uploadToR2 } from "../storage.js";
import { notifyReelComplete, notifyReelFailed } from "../notifications.js";

const router = Router();

// In-memory mutex — only one render at a time
let generating = false;
let generatingId: string | null = null;

export function isGenerating(): boolean {
  return generating;
}

router.post("/generate-reel/:scenarioId", authMiddleware, async (req: Request, res: Response) => {
  const { scenarioId } = req.params;

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

    // Apply broll model from Sheet config
    if (config.broll_model) {
      DEFAULTS.brollModel = config.broll_model;
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

    // Save scenario.json to disk (pipeline expects it there)
    saveScenario(scenarioData);

    // Update status
    await updateScenarioStatus(scenarioId, { status: "generating" });
    generating = true;
    generatingId = scenarioId;

    // Respond immediately
    res.json({ status: "generating", scenarioId });

    // Run pipeline in background
    runPipeline(scenarioId, scenarioData.id, scenario.title, config.alert_email).catch(() => {});

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
    });

    await appendLog({
      action: "generate-reel",
      scenario_id: sheetId,
      message: `Pipeline complete. Output: ${reelUrl}. Cost: $${totalCost.toFixed(4)}`,
      cost: totalCost,
    });

    console.log(`✓ Pipeline complete for "${pipelineId}"`);

    await notifyReelComplete(title, reelUrl, totalCost, alertEmail);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`✗ Pipeline failed for "${pipelineId}": ${message}`);

    await updateScenarioStatus(sheetId, {
      status: "approved",
      error: message.substring(0, 500),
    }).catch(() => {});

    await appendLog({
      action: "error",
      scenario_id: sheetId,
      message: `Pipeline failed: ${message.substring(0, 500)}`,
    }).catch(() => {});

    await notifyReelFailed(title, message.substring(0, 200), alertEmail);

  } finally {
    generating = false;
    generatingId = null;
  }
}

export default router;
