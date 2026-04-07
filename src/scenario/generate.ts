import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import type { SheetConfig } from "../api/sheets.js";

// ── Config ──

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function getModel(): string {
  return process.env.SCENARIO_MODEL || DEFAULT_MODEL;
}

// ── Zod schema matching scenario-format.md ──

const overlaySchema = z.object({
  text: z.string(),
  position: z.string(),
  animation: z.string(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  accentColor: z.string().optional(),
});

const sceneSchema = z.object({
  id: z.string(),
  scriptSegment: z.string(),
  visual: z.enum(["avatar", "broll", "screenshot"]),
  musicSection: z.enum(["intro", "product", "cta"]),
  brollAiPrompt: z.string().optional(),
  overlay: overlaySchema.optional(),
});

const scenarioSchema = z.object({
  id: z.string(),
  meta: z.object({
    title: z.string(),
    targetDuration: z.number().min(10).max(90),
  }),
  script: z.string(),
  scenes: z.array(sceneSchema).min(3),
});

export type Scenario = z.infer<typeof scenarioSchema>;

// ── Tool definition for structured output ──

const scenarioToolDef: Anthropic.Messages.Tool = {
  name: "save_scenarios",
  description: "Save the generated video ad scenarios",
  input_schema: {
    type: "object" as const,
    properties: {
      scenarios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "kebab-case ID, e.g. 'hotel-pain-30s'" },
            meta: {
              type: "object",
              properties: {
                title: { type: "string" },
                targetDuration: { type: "number", description: "Duration in seconds: 15, 30, or 45" },
              },
              required: ["title", "targetDuration"],
            },
            script: { type: "string", description: "Full continuous narration text. Each scene's scriptSegment must be an EXACT verbatim substring of this." },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  scriptSegment: { type: "string", description: "EXACT verbatim substring of the script field — copy-paste, do not rephrase" },
                  visual: { type: "string", enum: ["avatar", "broll", "screenshot"] },
                  musicSection: { type: "string", enum: ["intro", "product", "cta"] },
                  brollAiPrompt: { type: "string", description: "Detailed cinematic prompt for AI video generation. REQUIRED when visual=broll." },
                },
                required: ["id", "scriptSegment", "visual", "musicSection"],
              },
              minItems: 3,
            },
          },
          required: ["id", "meta", "script", "scenes"],
        },
      },
    },
    required: ["scenarios"],
  },
};

// ── Structural validation (rules from scenario-format.md) ──

function validateStructuralRules(scenario: Scenario): string[] {
  const errors: string[] = [];
  const { scenes, script } = scenario;

  // Scene 1 must be avatar
  if (scenes[0]?.visual !== "avatar") {
    errors.push("Scene 1 must have visual: 'avatar'");
  }

  // scriptSegment must be exact substring of script
  for (const scene of scenes) {
    if (!script.includes(scene.scriptSegment)) {
      errors.push(`Scene "${scene.id}": scriptSegment is not an exact substring of script`);
    }
  }

  // No two consecutive avatar scenes (except short CTA < 3 words at end)
  for (let i = 0; i < scenes.length - 1; i++) {
    if (scenes[i].visual === "avatar" && scenes[i + 1].visual === "avatar") {
      const isShortCta = scenes[i + 1].scriptSegment.split(/\s+/).length < 4
        && i + 1 === scenes.length - 1;
      if (!isShortCta) {
        errors.push(`Scenes "${scenes[i].id}" and "${scenes[i + 1].id}": two consecutive avatar scenes`);
      }
    }
  }

  // Broll scenes need brollAiPrompt
  for (const scene of scenes) {
    if (scene.visual === "broll" && !scene.brollAiPrompt) {
      errors.push(`Scene "${scene.id}": broll scene missing brollAiPrompt`);
    }
  }

  // Word budget check (~3 words/sec)
  const wordCount = script.split(/\s+/).length;
  const targetDuration = scenario.meta.targetDuration;
  const expectedMin = targetDuration * 2;
  const expectedMax = targetDuration * 3.5;
  if (wordCount < expectedMin || wordCount > expectedMax) {
    errors.push(`Word count ${wordCount} outside range [${expectedMin}-${expectedMax}] for ${targetDuration}s`);
  }

  // musicSection order: intro → product → cta (no going back)
  const sectionOrder = ["intro", "product", "cta"];
  let lastSectionIndex = 0;
  for (const scene of scenes) {
    const idx = sectionOrder.indexOf(scene.musicSection);
    if (idx < lastSectionIndex) {
      errors.push(`Scene "${scene.id}": musicSection "${scene.musicSection}" appears after later section`);
    }
    lastSectionIndex = idx;
  }

  return errors;
}

// ── Prompt builder ──

function loadKnowledgeFile(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "knowledge", filename), "utf-8");
  } catch {
    return "";
  }
}

export function buildPrompt(config: SheetConfig, existingTitles: string[]): {
  system: string;
  user: string;
} {
  const narrativeGuidelines = loadKnowledgeFile("narrative-guidelines.md");
  const scenarioFormat = loadKnowledgeFile("scenario-format.md");
  const brollGuide = loadKnowledgeFile("broll-prompting-guide.md");

  const system = `You are a video ad scenario generator for ${config.product_name}.

## Product Knowledge

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

**Competitive Differentiation:**
${config.competitors_diff}

**Brand Voice:**
${config.brand_voice}

## Narrative Guidelines

${narrativeGuidelines}

## Scenario JSON Format

${scenarioFormat}

## B-Roll Prompting Guide

${brollGuide}

## CRITICAL RULES

1. Each scene's scriptSegment must be a VERBATIM copy-paste substring of the script field. Do not rephrase, reorder, or abbreviate.
2. Scene 1 must always be visual: "avatar".
3. Never put two avatar scenes in a row (exception: final scene if < 3 words CTA).
4. Every broll scene MUST have brollAiPrompt — detailed, cinematic, following the b-roll prompting guide.
5. musicSection must progress in order: intro → product → cta. Never go backwards.
6. Do NOT include optional overrides (avatar, music, captionStyle, branding) — only minimal required fields.
7. Each scenario should use a DIFFERENT hook technique, framework angle, and target audience segment.
8. Default targetDuration is 30s. Only vary if batch_prompt explicitly asks for different durations.

Use the save_scenarios tool to return your output.`;

  const existingList = existingTitles.length > 0
    ? `\n\nAvoid these existing titles (do not duplicate or closely resemble them):\n${existingTitles.map(t => `- ${t}`).join("\n")}`
    : "";

  const batchPrompt = config.batch_prompt
    ? `\n\nAdditional direction: ${config.batch_prompt}`
    : "";

  const user = `Generate ${config.batch_size} unique video ad scenarios for ${config.product_name}.${batchPrompt}${existingList}`;

  return { system, user };
}

// ── Claude API call via tool_use ──

export async function callClaude(
  system: string,
  user: string,
): Promise<unknown[]> {
  const client = new Anthropic();
  const model = getModel();

  console.log(`Calling Claude (${model})...`);

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system,
    tools: [scenarioToolDef],
    tool_choice: { type: "tool", name: "save_scenarios" },
    messages: [{ role: "user", content: user }],
  });

  const toolBlock = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolBlock) {
    throw new Error("Claude did not call the save_scenarios tool");
  }

  const input = toolBlock.input as { scenarios?: unknown[] };
  if (!Array.isArray(input.scenarios)) {
    throw new Error("Tool call input.scenarios is not an array");
  }

  // Log usage for cost tracking
  const { input_tokens, output_tokens } = response.usage;
  console.log(`  Tokens: ${input_tokens} in / ${output_tokens} out`);

  return input.scenarios;
}

// ── Validate + retry loop ──

export interface GenerationResult {
  scenarios: Scenario[];
  errors: string[];
  attempts: number;
  model: string;
}

export async function generateScenarios(
  config: SheetConfig,
  existingTitles: string[],
): Promise<GenerationResult> {
  const { system, user } = buildPrompt(config, existingTitles);

  const allErrors: string[] = [];
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userMessage = attempt === 0
      ? user
      : `${user}\n\nYour previous response had validation errors. Fix ALL of them:\n${allErrors.slice(-10).map(e => `- ${e}`).join("\n")}`;

    const raw = await callClaude(system, userMessage);

    const validated: Scenario[] = [];
    const attemptErrors: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const parsed = scenarioSchema.safeParse(raw[i]);
      if (!parsed.success) {
        const zodErrors = parsed.error.issues.map(
          (iss) => `[${(raw[i] as any)?.meta?.title || `#${i}`}] ${iss.path.join(".")}: ${iss.message}`
        );
        attemptErrors.push(...zodErrors);
        continue;
      }

      const structuralErrors = validateStructuralRules(parsed.data);
      if (structuralErrors.length > 0) {
        attemptErrors.push(...structuralErrors.map(e => `[${parsed.data.meta.title}] ${e}`));
        continue;
      }

      validated.push(parsed.data);
    }

    if (attemptErrors.length > 0) {
      console.warn(`Attempt ${attempt + 1}: ${attemptErrors.length} errors, ${validated.length}/${raw.length} valid`);
      attemptErrors.forEach(e => console.warn(`  ${e}`));
      allErrors.push(...attemptErrors);
    }

    if (attemptErrors.length === 0 || (attempt === maxRetries && validated.length > 0)) {
      return {
        scenarios: validated,
        errors: allErrors,
        attempts: attempt + 1,
        model: getModel(),
      };
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts. Errors: ${allErrors.slice(-5).join("; ")}`);
}
