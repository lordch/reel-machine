import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { readConfig, readScenarios, writeScenarios, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";
import { generateScenarios, type ExistingScenario } from "../../scenario/generate.js";

const router = Router();

router.post("/generate-scenarios", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const config = await readConfig();
    const existing = await readScenarios();
    const existingScenarios: ExistingScenario[] = existing.map((s) => ({
      title: s.title,
      hook: s.script.split(".").slice(0, 2).join(".") + ".",
      audience: s.title, // title usually implies the audience angle
    }));

    // Extract broll prompts from last 5 scenarios for diversity
    const previousBrollPrompts: string[] = [];
    for (const s of existing.slice(-5)) {
      try {
        const parsed = JSON.parse(s.scenes_json);
        for (const scene of parsed.scenes || []) {
          if (scene.brollAiPrompt) previousBrollPrompts.push(scene.brollAiPrompt);
        }
      } catch {}
    }
    // Extract scripts from last 5 scenarios for diversity
    const previousScripts = existing.slice(-5).map(s => s.script).filter(Boolean);

    console.log(`Generating ${config.batch_size} scenarios for ${config.product_name} (${previousBrollPrompts.length} broll prompts, ${previousScripts.length} scripts from history)...`);

    const result = await generateScenarios(config, existingScenarios, previousBrollPrompts, previousScripts);

    const batchId = new Date().toISOString().slice(0, 10);

    const { totalCost } = result;
    const costPerScenario = result.scenarios.length > 0 ? totalCost / result.scenarios.length : 0;

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
      scenario_cost: costPerScenario,
      created_at: new Date().toISOString(),
      generated_at: "",
      published_at: "",
      error: "",
    }));

    await writeScenarios(rows);

    const { totalUsage } = result;

    const logMessage = [
      `Generated ${result.scenarios.length} scenarios`,
      `model: ${result.model}`,
      `attempts: ${result.attempts}`,
      `tokens: ${totalUsage.input_tokens}in/${totalUsage.output_tokens}out`,
      `cost: $${totalCost.toFixed(4)}`,
      result.errors.length > 0 ? `errors: ${result.errors.length}` : null,
    ].filter(Boolean).join(", ");

    await appendLog({
      action: "generate-scenarios",
      message: logMessage,
      cost: totalCost,
    });

    if (result.errors.length > 0) {
      await appendLog({
        action: "validation-errors",
        message: result.errors.join(" | ").substring(0, 5000),
      });
    }

    console.log(`✓ ${result.scenarios.length} scenarios written to Sheet (cost: $${totalCost.toFixed(4)})`);

    res.json({
      success: true,
      count: result.scenarios.length,
      titles: result.scenarios.map((s) => s.meta.title),
      model: result.model,
      attempts: result.attempts,
      usage: totalUsage,
      cost: totalCost,
      costPerScenario,
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
