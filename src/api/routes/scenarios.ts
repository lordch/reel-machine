import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { readConfig, readScenarios, writeScenarios, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";
import { generateScenarios } from "../../scenario/generate.js";

const router = Router();

router.post("/generate-scenarios", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const config = await readConfig();
    const existing = await readScenarios();
    const existingTitles = existing.map((s) => s.title);

    console.log(`Generating ${config.batch_size} scenarios for ${config.product_name}...`);

    const result = await generateScenarios(config, existingTitles);

    const batchId = new Date().toISOString().slice(0, 10);

    const rows = result.scenarios.map((s) => ({
      id: randomUUID(),
      batch_id: batchId,
      title: s.meta.title,
      framework: "",
      script: s.script,
      scenes_json: JSON.stringify(s),
      duration_sec: s.meta.targetDuration,
      status: "draft",
      reel_url: "",
      publish_urls: "",
      cost: 0,
      created_at: new Date().toISOString(),
      generated_at: "",
      published_at: "",
      error: "",
    }));

    await writeScenarios(rows);

    const logMessage = [
      `Generated ${result.scenarios.length} scenarios`,
      `model: ${result.model}`,
      `attempts: ${result.attempts}`,
      result.errors.length > 0 ? `errors: ${result.errors.length}` : null,
    ].filter(Boolean).join(", ");

    await appendLog({
      action: "generate-scenarios",
      message: logMessage,
    });

    // Log validation errors separately if any
    if (result.errors.length > 0) {
      await appendLog({
        action: "validation-errors",
        message: result.errors.join(" | ").substring(0, 5000),
      });
    }

    console.log(`✓ ${result.scenarios.length} scenarios written to Sheet`);

    res.json({
      success: true,
      count: result.scenarios.length,
      titles: result.scenarios.map((s) => s.meta.title),
      model: result.model,
      attempts: result.attempts,
      validationErrors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate scenarios failed:", message);

    await appendLog({
      action: "error",
      message: `generate-scenarios failed: ${message.substring(0, 500)}`,
    }).catch(() => {});

    res.status(500).json({ error: message });
  }
});

export default router;
