import { Router, type Request, type Response } from "express";
import { readScenarios, appendLog } from "../sheets.js";

const router = Router();

router.post("/poll-sheets", async (_req: Request, res: Response) => {
  try {
    const scenarios = await readScenarios();

    const approved = scenarios.find((s) => s.status === "approved");
    const approvedFinal = scenarios.find((s) => s.status === "approved_final");

    const actions: string[] = [];

    if (approved) {
      actions.push(`Would generate reel for: "${approved.title}" (${approved.id})`);
    }
    if (approvedFinal) {
      actions.push(`Would publish: "${approvedFinal.title}" (${approvedFinal.id})`);
    }

    if (actions.length === 0) {
      actions.push("No scenarios pending action");
    }

    await appendLog({
      action: "poll",
      message: actions.join("; "),
    });

    res.json({ success: true, actions, totalScenarios: scenarios.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
