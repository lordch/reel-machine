import "dotenv/config";
import express from "express";
import scenariosRouter from "./routes/scenarios.js";
import pollRouter from "./routes/poll.js";
import reelRouter from "./routes/reel.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(express.json());

// Health check — no auth
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Routes
app.use("/api", scenariosRouter);
app.use("/api", pollRouter);
app.use("/api", reelRouter);

app.listen(PORT, () => {
  console.log(`Reel Machine API running on port ${PORT}`);
});
