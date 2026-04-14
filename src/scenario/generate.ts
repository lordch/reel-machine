import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import type { SheetConfig } from "../api/sheets.js";

// ── Config ──

const DEFAULT_MODEL = "claude-sonnet-4-6";
const THINKING_BUDGET = 1024;
const SCENE_COUNT = { short: 7, medium: 9, long: 13 };
const TARGET_WORDS = { short: 50, medium: 75, long: 110 };
const WORD_TOLERANCE = 15;

function getModel(): string {
  return process.env.SCENARIO_MODEL || DEFAULT_MODEL;
}

function getSceneCount(duration: number): number {
  if (duration <= 20) return SCENE_COUNT.short;
  if (duration <= 35) return SCENE_COUNT.medium;
  return SCENE_COUNT.long;
}

function getTargetWords(duration: number): number {
  if (duration <= 20) return TARGET_WORDS.short;
  if (duration <= 35) return TARGET_WORDS.medium;
  return TARGET_WORDS.long;
}

// ── Types ──

export interface Scenario {
  id: string;
  meta: { title: string; targetDuration: number };
  script: string;
  scenes: {
    id: string;
    scriptSegment: string;
    visual: "avatar" | "broll";
    musicSection: "intro" | "product" | "cta";
    brollAiPrompt?: string;
    overlay?: { text: string; position: string; animation: string };
  }[];
}

export interface ExistingScenario {
  title: string;
  hook: string;
  audience: string;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface GenerationResult {
  scenarios: Scenario[];
  errors: string[];
  attempts: number;
  model: string;
  totalUsage: ClaudeUsage;
  totalCost: number;
}

// ── Pricing ──

const MODEL_PRICING: Record<string, { input: number; output: number; thinking: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15, thinking: 3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, thinking: 1 },
  "claude-opus-4-6": { input: 5, output: 25, thinking: 5 },
};

export function calculateCost(usage: ClaudeUsage, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-sonnet-4-6"];
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
  const cacheReadCost = (usage.cache_read_input_tokens / 1_000_000) * pricing.input * 0.1;
  // Note: thinking tokens are included in output_tokens by the API but billed at thinking rate
  // For now we approximate — exact split would need response.usage.thinking_tokens (not always available)
  return inputCost + outputCost + cacheReadCost;
}

// ── Helpers ──

function loadKnowledgeFile(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "knowledge", filename), "utf-8");
  } catch {
    return "";
  }
}

function addUsage(total: ClaudeUsage, add: ClaudeUsage): void {
  total.input_tokens += add.input_tokens;
  total.output_tokens += add.output_tokens;
  total.cache_read_input_tokens += add.cache_read_input_tokens;
  total.cache_creation_input_tokens += add.cache_creation_input_tokens;
}

function extractUsage(response: Anthropic.Messages.Message): ClaudeUsage {
  return {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: (response.usage as any).cache_read_input_tokens || 0,
    cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens || 0,
  };
}

async function callWithRetry(
  client: Anthropic,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  label: string,
  maxRetries = 2,
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params) as Anthropic.Messages.Message;
    } catch (err: any) {
      const status = err.status || err.statusCode || "";
      const message = err.message || String(err);
      const isRetryable = !status || status >= 500 || status === 429 || message.includes("fetch failed") || message.includes("ECONNRESET");

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(2 ** (attempt + 1), 15);
        console.warn(`  ⚠ ${label} failed (${status || "network"}): ${message.substring(0, 100)}. Retry ${attempt + 1}/${maxRetries} in ${delay}s...`);
        await new Promise(r => setTimeout(r, delay * 1000));
        continue;
      }

      throw new Error(`${label}: ${status ? `HTTP ${status} — ` : ""}${message}`);
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

function getToolBlock(response: Anthropic.Messages.Message, toolName: string): Anthropic.Messages.ToolUseBlock | undefined {
  return response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === toolName
  );
}

function logUsage(label: string, usage: ClaudeUsage, model: string): void {
  const cost = calculateCost(usage, model);
  const parts = [`${usage.input_tokens} in / ${usage.output_tokens} out`];
  if (usage.cache_read_input_tokens > 0) parts.push(`${usage.cache_read_input_tokens} cached`);
  console.log(`  ${label}: ${parts.join(", ")} | $${cost.toFixed(4)}`);
}

// Cached system prompt block helper
function cachedSystem(text: string): Anthropic.Messages.TextBlockParam {
  return { type: "text", text, cache_control: { type: "ephemeral" } };
}

// ═══════════════════════════════════════════════════════════
// STEP 1+2: Generate script → review in one conversation
// ═══════════════════════════════════════════════════════════

const scriptToolDef: Anthropic.Messages.Tool = {
  name: "save_script",
  description: "Save the generated ad script",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Human-readable title" },
      script: { type: "string", description: "The full narration text." },
    },
    required: ["title", "script"],
  },
};

async function generateAndReviewScript(
  config: SheetConfig,
  existingScenarios: ExistingScenario[],
  previousScripts: string[],
  targetDuration: number,
): Promise<{ title: string; script: string; issues: string[]; usage: ClaudeUsage }> {
  const client = new Anthropic();
  const model = getModel();
  const targetWords = getTargetWords(targetDuration);
  const totalUsage: ClaudeUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

  const scriptGuide = loadKnowledgeFile("script-writing.md");

  const existingList = existingScenarios.length > 0
    ? `\n\nThese already exist — create something genuinely different:\n${existingScenarios.map(s => `- "${s.title}" — ${s.hook}`).join("\n")}`
    : "";

  const previousScriptsList = previousScripts.length > 0
    ? `\n\nRecent scripts for reference — aim for fresh angles, hooks, and phrasing:\n${previousScripts.map((s, i) => `${i + 1}. "${s}"`).join("\n\n")}`
    : "";

  const batchPrompt = config.batch_prompt
    ? `\nAdditional direction: ${config.batch_prompt}`
    : "";

  // Shared system prompt (cached across turns)
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    cachedSystem(`You write and review narration scripts for short-form video ads. Just the spoken text — no scene directions, no visual descriptions, no formatting.

${scriptGuide}

WORD BUDGET: Each script must be ${targetWords - WORD_TOLERANCE}-${targetWords + WORD_TOLERANCE} words for a ${targetDuration}s ad. Count carefully — TTS will exceed ${targetDuration}s if you write more.

You MUST use the save_script tool to return your work. Do not respond with text — only use the tool.`),
  ];

  const messages: Anthropic.Messages.MessageParam[] = [{
    role: "user",
    content: `Write a narration script (${targetDuration}s, ${targetWords}±${WORD_TOLERANCE} words) for:

**Product:** ${config.product_name} (${config.website})
**Description:** ${config.product_description}

**Features:**
${config.product_features}

**Target Audience:**
${config.target_audience}

**Pain Points:**
${config.pain_points}

**Key Messages:**
${config.key_messages}

**Brand Voice:**
${config.brand_voice}${batchPrompt}${existingList}${previousScriptsList}`,
  }];

  // ── Turn 1: Generate script ──
  console.log(`Step 1: Generating script (target: ${targetWords} words, thinking: ${THINKING_BUDGET})...`);

  const resp1 = await callWithRetry(client, {
    model,
    max_tokens: THINKING_BUDGET + 2000,
    thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
    system: systemBlocks,
    tools: [scriptToolDef],
    messages,
  }, "Step 1: generate script");

  const usage1 = extractUsage(resp1);
  addUsage(totalUsage, usage1);
  logUsage("Generate", usage1, model);

  const toolBlock1 = getToolBlock(resp1, "save_script");
  if (!toolBlock1) throw new Error("Step 1: Claude did not call save_script");

  const { title, script } = toolBlock1.input as { title: string; script: string };
  const wc = script.split(/\s+/).length;
  console.log(`  "${title}" — ${wc} words`);

  // ── Turn 2: Review in same conversation ──
  console.log(`Step 2: Reviewing in same conversation...`);

  // Build review criteria
  const reviewChecks: string[] = [];
  if (wc < targetWords - WORD_TOLERANCE || wc > targetWords + WORD_TOLERANCE) {
    reviewChecks.push(`WORD COUNT: ${wc} words is outside ${targetWords - WORD_TOLERANCE}-${targetWords + WORD_TOLERANCE} range. Trim or expand.`);
  }
  if (!script.toLowerCase().includes(" is ") || !script.toLowerCase().includes(config.product_name.toLowerCase())) {
    reviewChecks.push(`PRODUCT CLARITY: Script may not clearly define what ${config.product_name} IS. Include "${config.product_name} is [product category] for [target]." within first 2-3 sentences.`);
  }
  reviewChecks.push("NATURAL FLOW: Does it sound like a real person talking? Fix any corporate/marketing buzzwords.");
  reviewChecks.push("CTA: Must end with short CTA (3-6 words).");

  // Continue the conversation: tool result → review request
  messages.push(
    { role: "assistant", content: resp1.content },
    { role: "user", content: [{ type: "tool_result", tool_use_id: toolBlock1.id, content: "Script received. Now review it." }] },
    { role: "user", content: `Now review the script you just wrote. Check:\n${reviewChecks.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nIf anything needs fixing, fix it and return the corrected version via save_script. If it's perfect, return it unchanged via save_script.` },
  );

  const resp2 = await callWithRetry(client, {
    model,
    max_tokens: THINKING_BUDGET + 2000,
    thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
    system: systemBlocks,
    tools: [scriptToolDef],
    messages,
  }, "Step 2: review script");

  const usage2 = extractUsage(resp2);
  addUsage(totalUsage, usage2);
  logUsage("Review", usage2, model);

  const toolBlock2 = getToolBlock(resp2, "save_script");
  const reviewed = toolBlock2?.input as { title: string; script: string } | undefined;

  const finalScript = reviewed?.script || script;
  const finalTitle = reviewed?.title || title;
  const finalWc = finalScript.split(/\s+/).length;

  const issues: string[] = [];
  if (finalScript !== script) {
    console.log(`  Fixed: ${wc} → ${finalWc} words`);
    issues.push(`Script revised: ${wc} → ${finalWc} words`);
  } else {
    console.log(`  ✓ Passed (${finalWc} words)`);
  }

  return { title: finalTitle, script: finalScript, issues, usage: totalUsage };
}

// ═══════════════════════════════════════════════════════════
// STEP 3: Split script into scenes + generate broll prompts
// ═══════════════════════════════════════════════════════════

const scenesToolDef = (sceneCount: number): Anthropic.Messages.Tool => ({
  name: "save_scenes",
  description: "Save the scene breakdown with broll prompts and overlays",
  input_schema: {
    type: "object" as const,
    properties: {
      scenes: {
        type: "array",
        description: `EXACTLY ${sceneCount} scenes. Odd positions (1st,3rd,5th...) = avatar, even (2nd,4th,6th...) = broll.`,
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "Exact consecutive slice of the script for this scene." },
            broll: { type: "string", description: "Cinematic AI video prompt. REQUIRED for even-numbered scenes (broll). Omit for avatar." },
            overlay: { type: "string", description: "Optional bold text overlay. 3-6 words max. Use on 2-3 scenes total." },
          },
          required: ["text"],
        },
        minItems: sceneCount,
        maxItems: sceneCount,
      },
    },
    required: ["scenes"],
  },
});

const rawSceneSchema = z.object({
  text: z.string().min(1),
  broll: z.string().optional(),
  overlay: z.string().optional(),
});

function validateScenes(
  scenes: z.infer<typeof rawSceneSchema>[],
  script: string,
  sceneCount: number,
): string[] {
  const errors: string[] = [];

  if (scenes.length !== sceneCount) {
    errors.push(`Expected ${sceneCount} scenes, got ${scenes.length}`);
  }

  const seen = new Set<string>();
  for (let i = 0; i < scenes.length; i++) {
    if (seen.has(scenes[i].text)) {
      errors.push(`Scene ${i + 1} has duplicate text: "${scenes[i].text.substring(0, 40)}..."`);
    }
    seen.add(scenes[i].text);

    // Broll prompt leaked into text
    if (scenes[i].text.includes("Photorealistic") || scenes[i].text.includes("35mm film")) {
      errors.push(`Scene ${i + 1}: broll prompt leaked into narrator text`);
    }
  }

  const reconstructed = scenes.map(s => s.text).join(" ");
  if (reconstructed !== script) {
    const rWords = reconstructed.split(/\s+/);
    const sWords = script.split(/\s+/);
    if (rWords.length !== sWords.length) {
      errors.push(`Script reconstruction failed: ${sWords.length} words in original, ${rWords.length} in scenes`);
    }
  }

  for (let i = 0; i < scenes.length; i++) {
    if (i % 2 === 1 && !scenes[i].broll) {
      errors.push(`Scene ${i + 1} (broll) missing broll prompt`);
    }
  }

  return errors;
}

async function splitIntoScenes(
  script: string,
  sceneCount: number,
  previousBrollPrompts: string[] = [],
): Promise<{ scenes: z.infer<typeof rawSceneSchema>[]; usage: ClaudeUsage }> {
  const client = new Anthropic();
  const model = getModel();
  const totalUsage: ClaudeUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

  const sceneGuide = loadKnowledgeFile("scene-splitting.md");

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    cachedSystem(`${sceneGuide}

You MUST use the save_scenes tool to return your work. Do not respond with text — only use the tool.`),
  ];

  const maxRetries = 2;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const feedback = lastErrors.length > 0
      ? `\n\nYour previous attempt had errors:\n${lastErrors.map(e => `- ${e}`).join("\n")}\nFix ALL of them.`
      : "";

    console.log(`Step 3${attempt > 0 ? ` (retry ${attempt})` : ""}: Splitting into ${sceneCount} scenes (thinking: ${THINKING_BUDGET})...`);

    const response = await callWithRetry(client, {
      model,
      max_tokens: THINKING_BUDGET + 8000,
      thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
      system: systemBlocks,
      tools: [scenesToolDef(sceneCount)],
        messages: [{
        role: "user",
        content: `Split this script into exactly ${sceneCount} consecutive, non-overlapping slices. Do NOT change any words.

Script:
"${script}"

Rules:
- ${sceneCount} scenes (${Math.ceil(sceneCount / 2)} avatar + ${Math.floor(sceneCount / 2)} broll)
- scene1.text + " " + scene2.text + ... = the exact script above
- NO duplicate scene texts
- Every broll scene MUST have a "broll" prompt — NEVER put broll prompt text in the "text" field
- Add "overlay" to 2-3 key scenes${feedback}${previousBrollPrompts.length > 0 ? `

For visual diversity, here are b-roll prompts from recent scenarios. Try to bring fresh visual ideas — different shot types, locations, moods, and approaches:
${previousBrollPrompts.map(p => `- "${p.substring(0, 120)}..."`).join("\n")}` : ""}`,
      }],
    }, "Step 3: split into scenes");

    const usage = extractUsage(response);
    addUsage(totalUsage, usage);
    logUsage("Split", usage, model);

    const toolBlock = getToolBlock(response, "save_scenes");
    const parsed = z.array(rawSceneSchema).safeParse((toolBlock?.input as any)?.scenes);

    if (!parsed.success) {
      console.warn(`  ✗ Parse failed`);
      lastErrors = ["Zod parse failed — return valid scene objects"];
      continue;
    }

    const errors = validateScenes(parsed.data, script, sceneCount);

    if (errors.length === 0) {
      console.log(`  ✓ ${parsed.data.length} scenes, ${parsed.data.filter(s => s.broll).length} broll, ${parsed.data.filter(s => s.overlay).length} overlays`);
      return { scenes: parsed.data, usage: totalUsage };
    }

    console.warn(`  ✗ ${errors.length} errors:`);
    errors.forEach(e => console.warn(`    - ${e}`));
    lastErrors = errors;

    if (attempt === maxRetries) {
      console.warn(`  Using scenes despite errors (last attempt)`);
      return { scenes: parsed.data, usage: totalUsage };
    }
  }

  throw new Error("splitIntoScenes failed after retries");
}

// ═══════════════════════════════════════════════════════════
// Transform scenes → pipeline format
// ═══════════════════════════════════════════════════════════

function buildScenario(
  title: string,
  scenes: z.infer<typeof rawSceneSchema>[],
  targetDuration: number,
): Scenario {
  const slug = title.toLowerCase().replace(/\s*\(\d+s\)\s*/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");
  const id = `${slug}-${targetDuration}s`;

  const pipelineScenes = scenes.map((scene, i) => {
    const isAvatar = i % 2 === 0;
    let musicSection: "intro" | "product" | "cta";
    const pos = i / scenes.length;
    if (pos < 0.33) musicSection = "intro";
    else if (pos < 0.78) musicSection = "product";
    else musicSection = "cta";

    return {
      id: `scene-${i}`,
      scriptSegment: scene.text,
      visual: (isAvatar ? "avatar" : "broll") as "avatar" | "broll",
      musicSection,
      ...(scene.broll && !isAvatar ? { brollAiPrompt: scene.broll } : {}),
      ...(scene.overlay ? { overlay: { text: scene.overlay, position: "center", animation: "slam" } } : {}),
    };
  });

  return {
    id,
    meta: { title, targetDuration },
    script: pipelineScenes.map(s => s.scriptSegment).join(" "),
    scenes: pipelineScenes,
  };
}

// ═══════════════════════════════════════════════════════════
// Main: orchestrate steps
// ═══════════════════════════════════════════════════════════

export async function generateScenarios(
  config: SheetConfig,
  existingScenarios: ExistingScenario[],
  previousBrollPrompts: string[] = [],
  previousScripts: string[] = [],
): Promise<GenerationResult> {
  const targetDuration = 30;
  const sceneCount = getSceneCount(targetDuration);
  const model = getModel();
  const totalUsage: ClaudeUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const allErrors: string[] = [];
  const scenarios: Scenario[] = [];

  // Keep rolling list of broll prompts (previous + generated in this batch)
  const brollHistory = [...previousBrollPrompts];

  for (let i = 0; i < config.batch_size; i++) {
    console.log(`\n── Scenario ${i + 1}/${config.batch_size} ──`);

    // Step 1+2: Generate + review script (one conversation)
    const scriptResult = await generateAndReviewScript(config, existingScenarios, previousScripts, targetDuration);
    addUsage(totalUsage, scriptResult.usage);
    if (scriptResult.issues.length > 0) {
      allErrors.push(...scriptResult.issues.map(e => `[${scriptResult.title}] ${e}`));
    }

    // Step 3: Split into scenes with broll prompts (pass last ~20 broll prompts for diversity)
    const sceneResult = await splitIntoScenes(scriptResult.script, sceneCount, brollHistory.slice(-20));
    addUsage(totalUsage, sceneResult.usage);

    const scenario = buildScenario(scriptResult.title, sceneResult.scenes, targetDuration);
    scenarios.push(scenario);

    // Collect broll prompts from this scenario for next iteration
    for (const scene of sceneResult.scenes) {
      if (scene.broll) brollHistory.push(scene.broll);
    }

    existingScenarios.push({
      title: scriptResult.title,
      hook: scriptResult.script.split(".").slice(0, 2).join(".") + ".",
      audience: scriptResult.title,
    });
  }

  const totalCost = calculateCost(totalUsage, model);
  console.log(`\nTotal: ${scenarios.length} scenarios, $${totalCost.toFixed(4)}`);

  return {
    scenarios,
    errors: allErrors,
    attempts: 1,
    model,
    totalUsage,
    totalCost,
  };
}
