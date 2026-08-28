// ── /api/chat ─────────────────────────────────────────────────────────────────
// AI agent endpoint. Streams responses using Vercel AI SDK.
// Protected by IP-based rate limiting via Upstash.

import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/cache/client";
import { runAgent, type AgentMessage } from "@/lib/ai/agent";
import { z } from "zod";

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
// 20 requests per minute per IP for anonymous users.
// Adjust limits when user accounts are added (Phase 11).

let ratelimit: Ratelimit | null = null;

function getRatelimit() {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: false,
      prefix: "finder:ratelimit",
    });
  }
  return ratelimit;
}

// ── REQUEST SCHEMA ────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(2000), // Prevent extremely long prompts
    })
  ).min(1).max(20), // Limit conversation history depth
  region: z.string().length(2).default("US"),
  subscriptions: z.array(z.string()).max(20).default([]),
});

// ── HANDLER ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Rate limit check
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "anonymous";

  // Rate-limit: race against a 1-second timeout.
  // WHY: Upstash Redis waits ~9s to time out when it can't connect (e.g. placeholder URL).
  //      Without the timeout, every single request blocks for 9s before the AI even starts.
  //      1 second is generous for a healthy Redis call; anything slower is a connection problem.
  //      Fail-open: if Redis is down we allow the request rather than blocking all users.
  try {
    const rl = getRatelimit();
    const oneSecond = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("rate-limit-timeout")), 1000)
    );
    const { success, remaining } = await Promise.race([rl.limit(ip), oneSecond]);
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  } catch {
    // Redis unavailable or timed out — allow the request (fail open)
    console.error("Rate limit check skipped — Redis not responding within 1s");
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, region, subscriptions } = parsed.data;

  // 3. Run agent and return response as JSON
  try {
    const text = await runAgent(messages as AgentMessage[], {
      region,
      userSubscriptions: subscriptions,
    });

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("Agent error:", message);
    console.error("Stack:", stack);

    // Return actual error message so we can see it in the browser during debugging
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
