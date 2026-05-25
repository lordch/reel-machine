import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export const MODEL_PRICING: Record<string, { input: number; output: number; thinking: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15, thinking: 3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, thinking: 1 },
  "claude-opus-4-6": { input: 5, output: 25, thinking: 5 },
};

export function calculateCost(usage: ClaudeUsage, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-sonnet-4-6"];
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
  const cacheReadCost = (usage.cache_read_input_tokens / 1_000_000) * pricing.input * 0.1;
  return inputCost + outputCost + cacheReadCost;
}

export function loadKnowledgeFile(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "knowledge", filename), "utf-8");
  } catch {
    return "";
  }
}

export function addUsage(total: ClaudeUsage, add: ClaudeUsage): void {
  total.input_tokens += add.input_tokens;
  total.output_tokens += add.output_tokens;
  total.cache_read_input_tokens += add.cache_read_input_tokens;
  total.cache_creation_input_tokens += add.cache_creation_input_tokens;
}

export function extractUsage(response: Anthropic.Messages.Message): ClaudeUsage {
  return {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: (response.usage as any).cache_read_input_tokens || 0,
    cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens || 0,
  };
}

export async function callWithRetry(
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
        console.warn(`  鈿� ${label} failed (${status || "network"}): ${message.substring(0, 100)}. Retry ${attempt + 1}/${maxRetries} in ${delay}s...`);
        await new Promise(r => setTimeout(r, delay * 1000));
        continue;
      }

      throw new Error(`${label}: ${status ? `HTTP ${status} 鈥� ` : ""}${message}`);
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

export function getToolBlock(response: Anthropic.Messages.Message, toolName: string): Anthropic.Messages.ToolUseBlock | undefined {
  return response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === toolName
  );
}

export function logUsage(label: string, usage: ClaudeUsage, model: string): void {
  const cost = calculateCost(usage, model);
  const parts = [`${usage.input_tokens} in / ${usage.output_tokens} out`];
  if (usage.cache_read_input_tokens > 0) parts.push(`${usage.cache_read_input_tokens} cached`);
  console.log(`  ${label}: ${parts.join(", ")} | $${cost.toFixed(4)}`);
}

export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam {
  return { type: "text", text, cache_control: { type: "ephemeral" } };
}
