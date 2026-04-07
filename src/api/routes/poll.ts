import { Router, type Request, type Response } from "express";
import { readScenarios, appendLog } from "../sheets.js";
import { isGenerating } from "./reel.js";

const router = Router();

router.post("/poll-sheets", async (_req: Request, res: Response) => {
  try {
    const scenarios = await readScenarios();
    const actions: string[] = [];

    // Find first "approved" → trigger reel generation
    const approved = scenarios.find((s) => s.status === "approved");
    if (approved && !isGenerating()) {
      actions.push(`Triggering reel generation for: "${approved.title}" (${approved.id})`);

      // Fire and forget — call our own endpoint
      const port = process.env.PORT || "3001";
      fetch(`http://localhost:${port}/api/generate-reel/${approved.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.API_SECRET}`,
        },
      }).catch((err) => console.error("Failed to trigger generate-reel:", err));

    } else if (approved && isGenerating()) {
      actions.push(`Waiting: "${approved.title}" queued but another render is in progress`);
    }

    // Find first "approved_final" → trigger publish (Phase 4)
    const approvedFinal = scenarios.find((s) => s.status === "approved_final");
    if (approvedFinal) {
      actions.push(`Would publish: "${approvedFinal.title}" (${approvedFinal.id}) — not yet implemented`);
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
