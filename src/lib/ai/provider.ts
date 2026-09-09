// ── AI PROVIDER ABSTRACTION ───────────────────────────────────────────────────
// ALL AI calls go through this file. Switching providers = changing this file only.
// Uses Vercel AI SDK — supports Anthropic, OpenAI, Google, Groq, and others.
//
// Current provider: Anthropic (claude-3-5-haiku-20241022)
//
// WHY Haiku:
//   • Fastest + cheapest Anthropic model — ideal for availability lookups
//   • Excellent at structured instruction following
//   • No tool-calling format issues (unlike the old Groq/OpenAI shim)

import { createAnthropic } from "@ai-sdk/anthropic";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it to your .env file");
  return createAnthropic({ apiKey });
}

/**
 * The primary AI model used by the agent.
 * claude-3-5-haiku-20241022 — Anthropic's fastest model, great for structured answers.
 */
export function getModel() {
  const anthropic = getAnthropicClient();
  return anthropic("claude-3-5-haiku-20241022");
}

/**
 * Model configuration constants.
 * Keep these centralized so they're easy to tune.
 */
export const MODEL_CONFIG = {
  maxTokens: 1024,
  temperature: 0.1, // Low temperature → factual, not creative (right for availability queries)
} as const;
