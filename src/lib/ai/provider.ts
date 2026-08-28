// ── AI PROVIDER ABSTRACTION ───────────────────────────────────────────────────
// ALL AI calls go through this file. Switching providers = changing this file only.
// Uses Vercel AI SDK — supports Anthropic, OpenAI, Google, Groq, and others.
//
// Current provider: Groq (FREE tier) via OpenAI-compatible endpoint
//
// WHY this approach:
//   Groq officially provides an OpenAI-compatible API at api.groq.com/openai/v1
//   We use @ai-sdk/openai (version-matched to the rest of our AI SDK) and just
//   point it at Groq's URL. This avoids version conflicts from @ai-sdk/groq.
//
// Model: llama-3.3-70b-versatile
//   • Meta's 70B LLaMA 3.3 model, hosted on Groq's fast inference hardware
//   • Free on Groq's developer plan — no credit card needed
//   • Strong at tool calling and following structured instructions
//
// To switch back to Anthropic later:
//   1. Import createAnthropic from "@ai-sdk/anthropic"
//   2. Change GROQ_API_KEY → ANTHROPIC_API_KEY in your .env
//   3. Return anthropic("claude-3-5-sonnet-20241022") from getModel()

import { createOpenAI } from "@ai-sdk/openai";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  // What: reads the key from environment variables (never hard-coded in source)
  // Why: keeps secrets out of Git — .env is in .gitignore
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — add it to your .env file");

  // createOpenAI normally talks to OpenAI's servers.
  // By passing a different baseURL, we redirect it to Groq's servers instead.
  // Groq's API is designed to be a drop-in replacement for OpenAI's API.
  return createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

/**
 * The primary AI model used by the agent.
 *
 * Model history:
 *   openai/gpt-oss-120b  → injected garbage tokens into tool names
 *   llama-3.1-8b-instant → not available on this Groq account
 *   qwen/qwen3.6-27b     → works, 8,000 TPM free tier
 *
 * Why 8,000 TPM is now fine:
 *   Previously requests took 45s and the SDK retried 3x, burning ~9,000 tokens per query.
 *   Now requests are ~5s with 3 steps max → ~2,000 tokens per query → well within limits.
 */
export function getModel() {
  const groq = getGroqClient();
  // What: .chat() forces the AI SDK to use OpenAI's Chat Completions API format.
  // Why: newer @ai-sdk/openai versions default to the "Responses API" (a newer OpenAI feature).
  //      Groq's API is Chat Completions-compatible but does NOT support the Responses API format.
  //      Without .chat(), the SDK sends Responses API requests → Groq rejects with
  //      "unsupported content types or unsupported content fields".
  return groq.chat("qwen/qwen3.6-27b");
}

/**
 * Model configuration constants.
 * Keep these centralized so they're easy to tune.
 */
export const MODEL_CONFIG = {
  maxTokens: 1024, // Was 2048 — availability answers don't need that much output
  temperature: 0.1, // Low temperature → factual, not creative (right for availability queries)
} as const;
