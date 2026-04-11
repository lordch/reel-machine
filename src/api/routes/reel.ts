import { Router, type Request, type Response } from "express";
import { readConfig, readScenarios, updateScenarioStatus, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";
import { saveScenario } from "../../pipeline/schema.js";
import { DEFAULTS } from "../../pipeline/config.js";
import { orchestrate } from "../../orchestrate.js";
import { getCostReport } from "../../pipeline/costs.js";

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

    // Save scenario.json to disk (pipeline expects it there)
    saveScenario(scenarioData);

    // Update status
    await updateScenarioStatus(scenarioId, { status: "generating" });
    generating = true;
    generatingId = scenarioId;

    // Respond immediately
    res.json({ status: "generating", scenarioId });

    // Run pipeline in background
    runPipeline(scenarioId, scenarioData.id).catch(() => {});

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

async function runPipeline(sheetId: string, pipelineId: string): Promise<void> {
  try {
    console.log(`\nStarting pipeline for "${pipelineId}" (sheet row: ${sheetId})...`);

    const outputPath = await orchestrate(pipelineId);

    // Read cost from pipeline output
    let totalCost = 0;
    try {
      const report = getCostReport(pipelineId);
      totalCost = report.total;
    } catch {}

    await updateScenarioStatus(sheetId, {
      status: "ready_for_review",
      reel_url: outputPath, // local path for now, R2 URL later
      cost: totalCost,
      generated_at: new Date().toISOString(),
      error: "",
    });

    await appendLog({
      action: "generate-reel",
      scenario_id: sheetId,
      message: `Pipeline complete. Output: ${outputPath}. Cost: $${totalCost.toFixed(4)}`,
      cost: totalCost,
    });

    console.log(`✓ Pipeline complete for "${pipelineId}"`);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`✗ Pipeline failed for "${pipelineId}": ${message}`);

    await updateScenarioStatus(sheetId, {
      status: "approved", // back to queue for retry
      error: message.substring(0, 500),
    }).catch(() => {});

    await appendLog({
      action: "error",
      scenario_id: sheetId,
      message: `Pipeline failed: ${message.substring(0, 500)}`,
    }).catch(() => {});

  } finally {
    generating = false;
    generatingId = null;
  }
}

export default router;
