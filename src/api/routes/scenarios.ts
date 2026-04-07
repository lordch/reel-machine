import { Router, type Request, type Response } from "express";
import { readConfig, readScenarios, appendLog } from "../sheets.js";
import { authMiddleware } from "../auth.js";

const router = Router();

// Placeholder — Phase 2 will add Claude generation
router.post("/generate-scenarios", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const config = await readConfig();
    const existing = await readScenarios();

    await appendLog({
      action: "generate-scenarios",
      message: `Config loaded: ${config.product_name}, ${existing.length} existing scenarios. (Generation not yet implemented)`,
    });

    res.json({
      success: true,
      message: "Sheets integration works! Scenario generation coming in Phase 2.",
      config: {
        product_name: config.product_name,
        batch_size: config.batch_size,
        language: config.language,
      },
      existingScenarios: existing.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
