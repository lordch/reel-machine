import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SheetConfig } from "../api/sheets.js";
import type { ReelScenario } from "../pipeline/schema.js";
import { addCost } from "../pipeline/costs.js";
import {
  type ClaudeUsage,
  calculateCost,
  loadKnowledgeFile,
  extractUsage,
  callWithRetry,
  getToolBlock,
  logUsage,
} from "./_anthropic-helpers.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function getModel(): string {
  return process.env.DESCRIPTION_MODEL || DEFAULT_MODEL;
}

export interface DescriptionResult {
  yt_description: string;
  meta_caption: string;
  cost: number;
  model: string;
}

const DescriptionSchema = z.object({
  yt_description: z.string().min(50).max(5000),
  meta_caption: z.string().min(50).max(2200),
});

const descriptionToolDef: Anthropic.Messages.Tool = {
  name: "save_description",
  description: "Save the YouTube description and Meta caption for the published reel. Both outputs must match the language of the provided script.",
  input_schema: {
    type: "object" as const,
    properties: {
      yt_description: {
        type: "string",
        description: "YouTube Shorts description. Language: match the script. Hook in first 100 chars. Full URL with https:// in line 2-3 (e.g. https://{website}) — bare domains are unreliably auto-linked. 3-5 sentence body. Bullet list of 3-5 features (✓). CTA with clickable https:// link. 3-5 hashtags last line, last one always #shorts. Target: 1500-3000 chars.",
      },
      meta_caption: {
        type: "string",
        description: "Instagram/Facebook Reels caption. Language: match the script. Hook + value prop in first 125 chars. 1-2 sentence body. Plain text 'Link in bio' (or matching phrase in the script's language) — do NOT include any URL (Meta penalizes reach for posts with URLs in caption). 3-5 hashtags at end (skip #shorts). Target: 200-500 chars.",
      },
    },
    required: ["yt_description", "meta_caption"],
  },
};

export async function generateDescriptionAndCaption(
  scenario: ReelScenario,
  config: SheetConfig,
  scenarioId: string,
): Promise<DescriptionResult> {
  const client = new Anthropic();
  const model = getModel();

  const guide = loadKnowledgeFile("description-caption.md");

  const sceneTexts = scenario.scenes
    .map((s, i) => `${i + 1}. ${s.scriptSegment}`)
    .join("\n");

  const systemPrompt = `${guide}

You MUST use the save_description tool to return your work. Do not respond with text — only use the tool.`;

  const userMessage = `Generate YouTube description + Meta caption for this reel. Match the language of the script below in both outputs.

**Title:** ${scenario.meta.title}
**Duration:** ${scenario.meta.targetDuration}s

**Full script (narration) — this determines output language:**
${scenario.script}

**Scenes (visual context):**
${sceneTexts}

---

**Product context:**
- Name: ${config.product_name}
- Website (bare domain — prepend https:// when linking): ${config.website}
- Description: ${config.product_description}

**Features (ONLY pick bullets from this list):**
${config.product_features}

**Target audience:**
${config.target_audience}

**Pain points:**
${config.pain_points}

**Key messages:**
${config.key_messages}

**Brand voice:**
${config.brand_voice}

---

Reminder: match the script's language exactly in both outputs. Use the save_description tool with both fields.`;

  console.log(`Generating YT description + Meta caption (${model})...`);

  let response: Anthropic.Messages.Message;
  try {
    response = await callWithRetry(client, {
      model,
      max_tokens: 4000,
      system: systemPrompt,
      tools: [descriptionToolDef],
      messages: [{ role: "user", content: userMessage }],
    }, "generate-description");
  } catch (err) {
    console.warn(`  ⚠ Description API call failed: ${err instanceof Error ? err.message : err}`);
    return fallback(scenario, model);
  }

  const usage = extractUsage(response);
  const cost = calculateCost(usage, model);
  logUsage("Description", usage, model);

  const toolBlock = getToolBlock(response, "save_description");
  if (!toolBlock) {
    console.warn("  ⚠ Claude did not call save_description, using fallback");
    return fallback(scenario, model);
  }

  const parsed = DescriptionSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    console.warn(`  ⚠ Description validation failed: ${parsed.error.message}, using fallback`);
    return fallback(scenario, model);
  }

  addCost(scenarioId, {
    step: "description",
    provider: "anthropic",
    detail: `${usage.input_tokens} in / ${usage.output_tokens} out`,
    cost,
  });

  console.log(`  ✓ yt: ${parsed.data.yt_description.length} chars, meta: ${parsed.data.meta_caption.length} chars`);

  return {
    yt_description: parsed.data.yt_description,
    meta_caption: parsed.data.meta_caption,
    cost,
    model,
  };
}

function fallback(scenario: ReelScenario, model: string): DescriptionResult {
  return {
    yt_description: `${scenario.meta.title}\n\n#shorts`,
    meta_caption: scenario.meta.title,
    cost: 0,
    model,
  };
}
