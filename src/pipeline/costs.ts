/**
 * Cost tracking for pipeline runs.
 *
 * Each pipeline step calls `addCost()` after API work.
 * Costs are persisted to `scenarios/{id}/output/costs.json`.
 *
 * Usage:
 *   import { addCost, getCostReport } from "./costs.js";
 *   addCost(scenarioId, { step: "audio", provider: "elevenlabs", detail: "847 chars", cost: 0.25 });
 */

import fs from "fs";
import path from "path";
import { scenarioDir } from "./schema.js";

export interface CostEntry {
  step: string;
  provider: string;
  detail: string;
  cost: number;
}

export interface CostReport {
  scenarioId: string;
  generatedAt: string;
  steps: CostEntry[];
  total: number;
}

function costsPath(scenarioId: string): string {
  return path.join(scenarioDir(scenarioId), "output", "costs.json");
}

function loadReport(scenarioId: string): CostReport {
  const p = costsPath(scenarioId);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return {
    scenarioId,
    generatedAt: new Date().toISOString(),
    steps: [],
    total: 0,
  };
}

function saveReport(scenarioId: string, report: CostReport): void {
  const p = costsPath(scenarioId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(report, null, 2));
}

/**
 * Add a cost entry for a pipeline step.
 */
export function addCost(scenarioId: string, entry: CostEntry): void {
  const report = loadReport(scenarioId);
  report.steps.push(entry);
  report.total = report.steps.reduce((sum, e) => sum + e.cost, 0);
  report.generatedAt = new Date().toISOString();
  saveReport(scenarioId, report);
  console.log(`  💰 ${entry.step}: $${entry.cost.toFixed(3)} (${entry.detail})`);
}

/**
 * Get full cost report for a scenario.
 */
export function getCostReport(scenarioId: string): CostReport {
  return loadReport(scenarioId);
}

/**
 * Print a formatted cost summary to console.
 */
export function printCostSummary(scenarioId: string): void {
  const report = loadReport(scenarioId);
  if (report.steps.length === 0) {
    console.log("No cost data recorded.");
    return;
  }
  console.log(`\nCost Report: ${report.scenarioId}`);
  console.log("─".repeat(50));
  for (const step of report.steps) {
    console.log(`  ${step.step.padEnd(10)} ${step.provider.padEnd(12)} $${step.cost.toFixed(3).padStart(6)}  ${step.detail}`);
  }
  console.log("─".repeat(50));
  console.log(`  ${"TOTAL".padEnd(10)} ${"".padEnd(12)} $${report.total.toFixed(3).padStart(6)}`);
}
