// ── AI AGENT ──────────────────────────────────────────────────────────────────
// The entertainment availability agent.
//
// ARCHITECTURE — why we don't use AI tool-calling:
//   AI SDK v7 + Groq has a known incompatibility: after the model calls a tool,
//   the SDK sends the tool result back to Groq in an "array content blocks" format
//   that Groq rejects with "unsupported content types".
//
//   Instead we use a simple pipeline:
//     1. AI extracts the title from the user's question (plain text generation, no tools)
//     2. We call TMDB APIs directly in code (fast, reliable, no format issues)
//     3. AI formats the final answer from the raw data (plain text generation, no tools)
//
//   This is faster (~2-3s vs 45s), more reliable, and sidesteps all tool-format issues.

import { generateText } from "ai";
import { getModel, MODEL_CONFIG } from "./provider";
import {
  searchMulti,
  getMovieWatchProviders,
  getTVWatchProviders,
} from "@/lib/api/tmdb";

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── AGENT ─────────────────────────────────────────────────────────────────────

export async function runAgent(
  messages: AgentMessage[],
  options: {
    region?: string;
    userSubscriptions?: string[];
    _knownTitle?: string;
    _knownYear?: number | null;
    _knownMediaType?: "movie" | "tv";
  } = {}
) {
  const { region = "US", _knownTitle, _knownYear, _knownMediaType } = options;

  // ── STEP 1: Extract the title ───────────────────────────────────────────────
  // What: ask the model to pull the movie/TV title out of the conversation.
  //
  // _knownTitle shortcut: when handlePick already identified the title from the
  // disambiguation list, skip AI extraction entirely.
  // Why: the recursive call with "Inception" as the last user message confuses the
  //   model — it sees the full disambiguation history and returns UNKNOWN because
  //   it thinks the user "just repeated the title". Injecting the known title
  //   bypasses that confusion completely.

  // ── PRE-CHECK: Fast code-side disambiguation pick ──────────────────────────
  // What: before calling AI, check if the user is responding to a pending numbered list
  //   with a pick in any common format.
  // Why: the AI reliably detects "1" but struggles with "what about 3", ordinals, etc.
  //   Handling it in code costs zero tokens and supports every reasonable variation:
  //   "2", "what about 3", "option 4", "#2", "the second one", "first", "2nd", etc.
  // Guard: only fires when a disambiguation list exists AND the message is short (< 30 chars)
  //   — prevents false matches on real titles like "Spider-Man 2".

  if (!_knownTitle) {
    const ORDINALS: Record<string, number> = {
      first: 1, second: 2, third: 3, fourth: 4,
      "1st": 1, "2nd": 2, "3rd": 3, "4th": 4,
    };

    const lastMsg = messages[messages.length - 1]?.content?.trim() ?? "";
    const pendingList = [...messages]
      .slice(0, -1) // exclude the user's current message
      .reverse()
      .find((m) => m.role === "assistant" && /\d+\.\s+/.test(m.content));

    if (pendingList && lastMsg.length < 30) {
      const digitMatch = lastMsg.match(/\b([1-9])\b/);
      const ordinalEntry = Object.entries(ORDINALS).find(([word]) =>
        new RegExp(`\\b${word}\\b`, "i").test(lastMsg)
      );
      const pickNum = digitMatch ? digitMatch[1] : ordinalEntry ? String(ordinalEntry[1]) : null;

      if (pickNum) {
        console.log("[agent] fast pick detected:", pickNum);
        return handlePick(`PICK:${pickNum}`, messages, region);
      }
    }
  }

  let extracted: string;

  if (_knownTitle) {
    extracted = _knownTitle;
    console.log("[agent] using known title (from pick):", extracted);
  } else {
    // Ask the model to wrap the title in <title>…</title> tags.
    // Why tags: qwen3.6-27b outputs a chain-of-thought reasoning block before its answer,
    //   so titleResult.text contains pages of thinking + the title. A specific XML tag
    //   lets us pull out just the title regardless of surrounding text.
    const titleResult = await generateText({
      model: getModel(),
      system:
        "Extract the movie or TV show title from the user's message.\n" +
        "Output format: wrap your answer in <title> tags.\n" +
        "Examples:\n" +
        "  <title>Inception</title>\n" +
        "  <title>PICK:2</title>\n" +
        "  <title>UNKNOWN</title>\n" +
        "Rules:\n" +
        "- If a clear title exists, output <title>THE TITLE</title> (no year, no punctuation).\n" +
        "- If the user is picking from a numbered list (e.g. replies '1' or '2'), output <title>PICK:NUMBER</title>.\n" +
        "- If no clear title, output <title>UNKNOWN</title>.\n" +
        "Output the tag and nothing else.",
      messages: messages.slice(-3), // Last 3 messages give enough context
      maxOutputTokens: 300,          // Generous: model may think before outputting the tag
      temperature: 0,
      maxRetries: 0,
    });

    // Parse the title from the model response — multi-step to handle the thinking model:
    //   qwen3.6-27b always emits a reasoning block before answering, in two possible formats:
    //   (a) <think>…reasoning…</think> then the actual tag
    //   (b) Plain "Thinking Process: …" text then the tag
    //   The <think> block sometimes ends up INSIDE the <title> tag, contaminating the value.
    //   Strategy: strip <think> blocks, then parse <title>, then fall back to "Title: X" pattern.
    const fullText = titleResult.text ?? "";
    console.log("[agent] raw model output:", JSON.stringify(fullText.slice(0, 200)));

    const cleanText = fullText
      .replace(/<think>[\s\S]*?<\/think>/gi, "") // Remove complete <think>…</think> blocks
      .replace(/<think>[\s\S]*/gi, "")           // Remove unclosed <think> (cut off by token limit)
      .trim();

    // [\s\S]*? (not .*?) so the match works when the model puts the value on a new line
    const tagMatch = cleanText.match(/<title>([\s\S]*?)<\/title>/i);
    if (tagMatch) {
      extracted = tagMatch[1].trim() || "UNKNOWN";
    } else {
      // Fallback: look for "Title: Something" in the plain-text thinking format
      const titleLineMatch = cleanText.match(/Title:\s*([^\n*]+)/i);
      if (titleLineMatch) {
        extracted = titleLineMatch[1].replace(/[*_`]/g, "").trim() || "UNKNOWN";
      } else {
        // Last resort: if what's left is short, treat it as the title itself
        extracted = cleanText.length > 0 && cleanText.length < 80 ? cleanText : "UNKNOWN";
      }
    }
    console.log("[agent] extracted:", extracted);

    // Handle disambiguation picks: user replied "1" or "2" after we listed options
    if (extracted.startsWith("PICK:")) {
      return handlePick(extracted, messages, region);
    }

    if (!extracted || extracted === "UNKNOWN") {
      return "I'm not sure which title you mean. Could you mention the movie or TV show name?";
    }
  }

  // ── STEP 2: Search TMDB ─────────────────────────────────────────────────────
  // What: find the title in TMDB's database to get its ID.
  // Why code instead of AI tool: direct API call → no SDK tool-format issues.

  let searchResults;
  try {
    const res = await searchMulti(extracted);
    searchResults = res.results
      .filter((r) => r.media_type !== "person")
      .slice(0, 5);
  } catch {
    return "I had trouble searching for that title — the movie database may be temporarily unavailable. Please try again.";
  }

  if (searchResults.length === 0) {
    return `I couldn't find "${extracted}" in the movie/TV database. Try checking the spelling or using the full title.`;
  }

  // ── STEP 3: Pick the right result ──────────────────────────────────────────
  // What: identify which search result to use.
  // Two paths:
  //   A) _knownYear/_knownMediaType set (user just picked from a list) → find the exact
  //      matching result by year + type so we never show the disambiguation list twice.
  //   B) Fresh search → disambiguate if there are multiple meaningfully different titles.

  let topResult = searchResults[0];

  // Path A: user already made a pick — match by year and/or media type
  if (_knownYear || _knownMediaType) {
    const exact = searchResults.find((r) => {
      const resultYear = r.release_date
        ? new Date(r.release_date).getFullYear()
        : r.first_air_date
        ? new Date(r.first_air_date).getFullYear()
        : null;
      const yearOk = !_knownYear || resultYear === _knownYear;
      const typeOk = !_knownMediaType || r.media_type === _knownMediaType;
      return yearOk && typeOk;
    });
    if (exact) topResult = exact;
    // If no exact match (unusual), fall through with topResult = first result
  } else {
    // Path B: fresh search — ask user to pick if there are multiple distinct titles
    const secondResult = searchResults[1];
    const needsDisambiguation =
      secondResult &&
      (secondResult.title ?? secondResult.name) !== (topResult.title ?? topResult.name);

    if (needsDisambiguation) {
      const disambigOptions = searchResults.slice(0, 4).map((r, i) => {
        const title = r.title ?? r.name ?? "Unknown";
        const year = r.release_date
          ? new Date(r.release_date).getFullYear()
          : r.first_air_date
          ? new Date(r.first_air_date).getFullYear()
          : null;
        const type = r.media_type === "tv" ? "TV Show" : "Movie";
        return `${i + 1}. ${title}${year ? ` (${year})` : ""} — ${type}`;
      });

      return `I found a few titles matching "${extracted}". Which one do you mean?\n\n${disambigOptions.join("\n")}\n\nReply with the number.`;
    }
  }

  // ── STEP 4: Fetch watch providers ──────────────────────────────────────────
  // What: get which streaming platforms have this title in the user's region.
  // Source: TMDB Watch Providers (powered by JustWatch) — unlimited & free.

  let providers;
  try {
    providers =
      topResult.media_type === "movie"
        ? await getMovieWatchProviders(topResult.id)
        : await getTVWatchProviders(topResult.id);
  } catch {
    return "I found the title but couldn't load streaming information right now. Please try again in a moment.";
  }

  const regionData = providers.results[region.toUpperCase()] ?? null;

  // ── STEP 5: Format the answer ───────────────────────────────────────────────
  // What: give the AI the raw availability data and ask it to write a clean reply.
  // Why plain text generation (no tools): we already have all the data — the AI's only
  //   job here is to format it nicely. No tool calls needed → no format issues.

  const title = topResult.title ?? topResult.name ?? "Unknown";
  const year = topResult.release_date
    ? new Date(topResult.release_date).getFullYear()
    : topResult.first_air_date
    ? new Date(topResult.first_air_date).getFullYear()
    : null;

  const dataForAI = regionData
    ? {
        title,
        year,
        type: topResult.media_type === "tv" ? "TV Show" : "Movie",
        region,
        subscription: regionData.flatrate?.map((p) => p.provider_name) ?? [],
        free: regionData.free?.map((p) => p.provider_name) ?? [],
        rent: regionData.rent?.map((p) => p.provider_name) ?? [],
        buy: regionData.buy?.map((p) => p.provider_name) ?? [],
        justWatchLink: regionData.link ?? null,
      }
    : { title, year, type: topResult.media_type, region, notAvailable: true };

  const formatResult = await generateText({
    model: getModel(),
    system:
      "You format streaming availability data into a short, clear reply. " +
      "List platforms by type: subscription, free, rent, buy. " +
      "If a category is empty, skip it. " +
      "If notAvailable is true, say the title isn't currently available for streaming in that region. " +
      "Be concise — 2-5 lines max. No markdown headers.",
    messages: [
      { role: "user", content: `Data: ${JSON.stringify(dataForAI)}` },
    ],
    maxOutputTokens: MODEL_CONFIG.maxTokens,
    temperature: MODEL_CONFIG.temperature,
    maxRetries: 0,
  });

  // Strip <think>…</think> reasoning blocks from the format response — same issue as
  // in the title extraction step: qwen3.6-27b prepends its chain-of-thought to the reply.
  const rawFormat = formatResult.text ?? "";
  const cleanFormat = rawFormat
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .trim();

  console.log("[agent] format step text length:", cleanFormat.length);
  return cleanFormat || buildFallbackText(title, year, regionData, region);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

// handlePick: user replied "1" after we showed a disambiguation list.
// We re-read the previous assistant message to find which title they picked,
// then call runAgent with _knownTitle to skip AI extraction (the recursive call
// with conversation history confuses the model into returning UNKNOWN).
async function handlePick(
  extracted: string,
  messages: AgentMessage[],
  region: string
): Promise<string> {
  const pickNum = parseInt(extracted.replace("PICK:", ""), 10) - 1;

  // What: find the most recent assistant message that contains a numbered list.
  // Why not just the most recent assistant message: after the user picks "1" and gets
  //   streaming info, the conversation has more assistant messages (the streaming answer,
  //   error messages, etc.). If the user then says "what about 3", we need to look back
  //   to find the original disambiguation list, not the streaming answer.
  const prevAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && /\d+\.\s+/.test(m.content));
  if (!prevAssistant) return "I lost track of the options. Could you repeat the title?";

  // Parse the numbered list — handle both newline-separated and flat (spaces only) formats.
  // Why two approaches: chat UIs sometimes strip \n from stored messages, turning
  //   "1. Inception\n2. Batman" into "1. Inception  2. Batman" in the history.
  let lines = prevAssistant.content.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  if (lines.length === 0) {
    lines = Array.from(
      prevAssistant.content.matchAll(/(\d+\.\s+.+?)(?=\s{2,}\d+\.|\s*Reply|$)/g),
      (m) => m[1].trim()
    );
  }
  const picked = lines[pickNum];
  if (!picked) return "I couldn't match that number to the list. Could you name the title directly?";

  // Extract title from "1. Inception (2010) — Movie" → "Inception"
  const titleMatch = picked.match(/^\d+\.\s+(.+?)(?:\s+\(\d{4}\))?(?:\s+—|$)/);
  if (!titleMatch) return "I couldn't read that choice. Could you name the title directly?";

  const knownTitle = titleMatch[1].trim();

  // Also parse year and media type from "1. Inception (2010) — Movie"
  // so runAgent can find the exact result without asking the user to disambiguate again.
  const yearMatch = picked.match(/\((\d{4})\)/);
  const knownYear = yearMatch ? parseInt(yearMatch[1]) : null;
  const knownMediaType = picked.includes("TV Show") ? "tv" : "movie";
  console.log("[agent] pick resolved:", knownTitle, knownYear, knownMediaType);

  // Use _knownTitle to bypass AI extraction — avoids the model getting confused
  // by seeing "Inception" after a disambiguation list and returning UNKNOWN.
  // Use _knownYear + _knownMediaType to skip re-disambiguation on the same results.
  return runAgent(messages, { region, _knownTitle: knownTitle, _knownYear: knownYear, _knownMediaType: knownMediaType });
}

// buildFallbackText: generates a plain text answer if the AI formatting step fails.
function buildFallbackText(
  title: string,
  year: number | null,
  regionData: {
    flatrate?: { provider_name: string }[];
    free?: { provider_name: string }[];
    rent?: { provider_name: string }[];
    buy?: { provider_name: string }[];
    link?: string;
  } | null,
  region: string
): string {
  const label = `${title}${year ? ` (${year})` : ""} · ${region}`;

  if (!regionData) {
    return `${label}\n\nNot currently available for streaming in ${region}.`;
  }

  const lines: string[] = [label, ""];
  if (regionData.flatrate?.length)
    lines.push(`Subscription: ${regionData.flatrate.map((p) => p.provider_name).join(", ")}`);
  if (regionData.free?.length)
    lines.push(`Free: ${regionData.free.map((p) => p.provider_name).join(", ")}`);
  if (regionData.rent?.length)
    lines.push(`Rent: ${regionData.rent.map((p) => p.provider_name).join(", ")}`);
  if (regionData.buy?.length)
    lines.push(`Buy: ${regionData.buy.map((p) => p.provider_name).join(", ")}`);
  if (regionData.link)
    lines.push(`\nFull details: ${regionData.link}`);
  if (lines.length === 2)
    lines.push(`Not currently available for streaming in ${region}.`);

  return lines.join("\n");
}
