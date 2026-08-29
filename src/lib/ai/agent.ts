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
//
// IMPROVEMENTS v2:
//   • Recommendation mode  — detects mood/genre queries, discovers streaming titles
//   • Not-available pivot  — suggests similar titles that ARE streaming
//   • Stale-data disclaimer — every answer ends with a freshness note
//   • Tighter format prompt — subscription-first, max 4 services, no filler
//   • Region-aware          — region is now passed from the client's locale detection
//   • Deeper context window — title extraction now uses last 6 messages (was 3)

import { generateText } from "ai";
import { getModel, MODEL_CONFIG } from "./provider";
import {
  searchMulti,
  getMovieWatchProviders,
  getTVWatchProviders,
  getSimilarMovies,
  getSimilarTVShows,
} from "@/lib/api/tmdb";

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── RECOMMENDATION CONSTANTS ──────────────────────────────────────────────────
//
// RECOMMEND_RE: matches queries that ask for suggestions rather than a specific title.
// Must NOT fire when a specific title is mentioned (e.g. "suggest me Inception" still
// goes through the title-lookup path because extracted title won't be UNKNOWN).
// The recommendation path only activates when title extraction returns UNKNOWN.

const RECOMMEND_RE =
  /\b(recommend|suggest( me)?|something (to watch|scary|funny|good|dark|light|short)|what (should|to) watch|in the mood (for|to)|feel like watching|looking for (a |something)|any good (movies?|shows?|films?)|give me (a |some))\b/i;

// Keyword → TMDB search query for that genre/mood.
// Ordered so more specific terms appear before generic ones.
const GENRE_QUERY: [RegExp, string][] = [
  [/\b(horror|scary|spooky|creepy|frightening)\b/i,         "best horror movies"],
  [/\b(comedy|funny|hilarious|laugh|humour|humor)\b/i,      "best comedy movies"],
  [/\b(thriller|suspense|tense)\b/i,                        "best thriller movies"],
  [/\b(action|explosive|fight|superhero)\b/i,               "best action movies"],
  [/\b(romance|romantic|love story)\b/i,                    "best romance movies"],
  [/\b(sci.?fi|science fiction|space|futuristic)\b/i,       "best science fiction movies"],
  [/\b(drama|emotional|heavy|intense)\b/i,                  "best drama movies"],
  [/\b(animated|animation|cartoon)\b/i,                     "best animated movies"],
  [/\b(documentary|docuseries|true story|real)\b/i,         "best documentaries"],
  [/\b(mystery|whodunit|detective)\b/i,                     "best mystery movies"],
  [/\b(crime|heist|gangster|mob)\b/i,                       "best crime movies"],
  [/\b(fantasy|magic|wizard|mythical)\b/i,                  "best fantasy movies"],
  [/\b(adventure|travel|explore)\b/i,                       "best adventure movies"],
  [/\b(family|kids|children)\b/i,                           "best family movies"],
  [/\b(tv show|series|binge|season)\b/i,                    "best tv series"],
];

function extractSearchQuery(text: string): string {
  for (const [pattern, query] of GENRE_QUERY) {
    if (pattern.test(text)) return query;
  }
  return "popular movies streaming now";
}

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
  const {
    region = "US",
    userSubscriptions = [],
    _knownTitle,
    _knownYear,
    _knownMediaType,
  } = options;

  // ── PRE-CHECK: Fast code-side disambiguation pick ──────────────────────────
  // What: before calling AI, check if the user is responding to a pending numbered list.
  // Guard: only fires when a disambiguation list exists AND the message is short (< 30 chars).

  if (!_knownTitle) {
    const ORDINALS: Record<string, number> = {
      first: 1, second: 2, third: 3, fourth: 4,
      "1st": 1, "2nd": 2, "3rd": 3, "4th": 4,
    };

    const lastMsg = messages[messages.length - 1]?.content?.trim() ?? "";
    const pendingList = [...messages]
      .slice(0, -1)
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

  // ── STEP 1: Extract the title ───────────────────────────────────────────────

  let extracted: string;

  if (_knownTitle) {
    extracted = _knownTitle;
    console.log("[agent] using known title (from pick):", extracted);
  } else {
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
      // Use last 6 messages for better context (e.g. resolves "what about the sequel?")
      messages: messages.slice(-6),
      maxOutputTokens: 300,
      temperature: 0,
      maxRetries: 0,
    });

    const fullText = titleResult.text ?? "";
    console.log("[agent] raw model output:", JSON.stringify(fullText.slice(0, 200)));

    const cleanText = fullText
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*/gi, "")
      .trim();

    const tagMatch = cleanText.match(/<title>([\s\S]*?)<\/title>/i);
    if (tagMatch) {
      extracted = tagMatch[1].trim() || "UNKNOWN";
    } else {
      const titleLineMatch = cleanText.match(/Title:\s*([^\n*]+)/i);
      if (titleLineMatch) {
        extracted = titleLineMatch[1].replace(/[*_`]/g, "").trim() || "UNKNOWN";
      } else {
        extracted = cleanText.length > 0 && cleanText.length < 80 ? cleanText : "UNKNOWN";
      }
    }
    console.log("[agent] extracted:", extracted);

    if (extracted.startsWith("PICK:")) {
      return handlePick(extracted, messages, region);
    }

    // ── RECOMMENDATION MODE ─────────────────────────────────────────────────
    // Fire when no clear title found AND the query looks like a recommendation request.
    // This means the user wants suggestions, not a specific title lookup.

    if (!extracted || extracted === "UNKNOWN") {
      const lastUserMsg = messages[messages.length - 1]?.content ?? "";
      if (RECOMMEND_RE.test(lastUserMsg)) {
        console.log("[agent] switching to recommendation mode");
        return runRecommendAgent(lastUserMsg, { region, userSubscriptions });
      }
      return "I'm not sure which title you mean. Could you mention the movie or TV show name?";
    }
  }

  // ── STEP 2: Search TMDB ─────────────────────────────────────────────────────

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

  let topResult = searchResults[0];

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
  } else {
    const secondResult = searchResults[1];
    const namesAreDifferent =
      secondResult &&
      (secondResult.title ?? secondResult.name) !== (topResult.title ?? topResult.name);

    const topPop    = (topResult as { popularity?: number }).popularity ?? 0;
    const secondPop = secondResult
      ? (secondResult as { popularity?: number }).popularity ?? 0
      : 0;

    const isDominant   = topPop > 15 && (!secondResult || topPop > secondPop * 4);
    const isExactMatch =
      (topResult.title ?? topResult.name ?? "").toLowerCase() === extracted.toLowerCase() &&
      ((topResult as { vote_count?: number }).vote_count ?? 0) > 300;

    const needsDisambiguation = namesAreDifferent && !isDominant && !isExactMatch;

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

  // ── STEP 5: Build data for the format step ─────────────────────────────────

  const title = topResult.title ?? topResult.name ?? "Unknown";
  const year = topResult.release_date
    ? new Date(topResult.release_date).getFullYear()
    : topResult.first_air_date
    ? new Date(topResult.first_air_date).getFullYear()
    : null;

  const hasStreaming =
    (regionData?.flatrate?.length ?? 0) > 0 || (regionData?.free?.length ?? 0) > 0;

  // ── NOT-AVAILABLE PIVOT ────────────────────────────────────────────────────
  // When there's nothing free/subscription, fetch similar titles that ARE streaming
  // so the AI can suggest alternatives rather than just saying "not available."

  let streamingAlternatives: { title: string; year: number | null; streaming: string[] }[] = [];

  if (!hasStreaming) {
    try {
      const similar =
        topResult.media_type === "movie"
          ? await getSimilarMovies(topResult.id)
          : await getSimilarTVShows(topResult.id);

      const altChecks = await Promise.allSettled(
        similar.results.slice(0, 6).map(async (r) => {
          const prov =
            topResult.media_type === "movie"
              ? await getMovieWatchProviders(r.id)
              : await getTVWatchProviders(r.id);
          const rd = prov.results[region.toUpperCase()] ?? null;
          const streaming = rd?.flatrate?.map((p) => p.provider_name) ?? [];
          if (streaming.length === 0) return null;
          const altTitle = r.title ?? r.name ?? "Unknown";
          const altYear = r.release_date
            ? new Date(r.release_date).getFullYear()
            : r.first_air_date
            ? new Date(r.first_air_date).getFullYear()
            : null;
          return { title: altTitle, year: altYear, streaming };
        })
      );

      streamingAlternatives = altChecks
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<typeof streamingAlternatives[0] | null>).value!)
        .slice(0, 3);
    } catch {
      // Non-fatal: just proceed without alternatives
    }
  }

  // ── Build the data object passed to the AI format step ────────────────────

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
        ...(streamingAlternatives.length > 0 && { streamingAlternatives }),
      }
    : {
        title,
        year,
        type: topResult.media_type === "tv" ? "TV Show" : "Movie",
        region,
        notAvailable: true,
        streamingAlternatives,
      };

  // ── STEP 6: Format the answer ───────────────────────────────────────────────

  const subscriptionNote =
    userSubscriptions.length > 0
      ? `\n\nThe user subscribes to: ${userSubscriptions.join(", ")}. ` +
        `If ANY subscription platform appears in the data, lead with "✅ You've got it on [Service]!" ` +
        `If none of their subscriptions cover it, open with "🚫 Not on your subscriptions — " then list alternatives.`
      : "";

  const userQuestion = messages[messages.length - 1]?.content ?? "";

  const formatResult = await generateText({
    model: getModel(),
    system:
      `You write ultra-concise streaming availability answers. Speak directly to the user.\n\n` +
      `STRICT RULES:\n` +
      `1. Subscription check: if user subscriptions match a streaming platform → lead with "✅ [Title] is on [Service]!"\n` +
      `2. Order services: subscription → free → rent → buy. Show MAX 4 services total.\n` +
      `3. Skip any category that's empty — do not write empty lines or dashes.\n` +
      `4. If notAvailable is true → say "[Title] isn't streaming in [region] right now."\n` +
      `   - If rent/buy options exist → "But you can rent/buy on [platforms]."\n` +
      `   - If streamingAlternatives exist → "You might like [Title] instead — it's on [Platform]."\n` +
      `5. End EVERY response (unavailable or not) with this exact line: "_Availability from TMDB · may have changed._"\n` +
      `6. No markdown headers, no bullet dashes. Max 6 lines total. Be conversational, not robotic.` +
      subscriptionNote,
    messages: [
      {
        role: "user",
        content: `User asked: "${userQuestion}"\n\nData: ${JSON.stringify(dataForAI)}`,
      },
    ],
    maxOutputTokens: MODEL_CONFIG.maxTokens,
    temperature: MODEL_CONFIG.temperature,
    maxRetries: 0,
  });

  const rawFormat = formatResult.text ?? "";
  const cleanFormat = rawFormat
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .trim();

  console.log("[agent] format step text length:", cleanFormat.length);
  return cleanFormat || buildFallbackText(title, year, regionData, region);
}

// ── RECOMMENDATION AGENT ──────────────────────────────────────────────────────
// Called when the user asks for suggestions rather than a specific title.
// Searches TMDB by mood/genre, checks streaming availability, returns top picks.

async function runRecommendAgent(
  userQuery: string,
  options: { region: string; userSubscriptions: string[] }
): Promise<string> {
  const { region, userSubscriptions } = options;
  const searchQuery = extractSearchQuery(userQuery);
  console.log("[recommend] query:", searchQuery);

  // Search TMDB for titles matching the mood/genre
  let searchResults;
  try {
    const res = await searchMulti(searchQuery);
    searchResults = res.results.filter((r) => r.media_type !== "person").slice(0, 8);
  } catch {
    return "I had trouble finding recommendations right now. Please try again.";
  }

  if (searchResults.length === 0) {
    return "I couldn't find anything for that mood. Try a different genre?";
  }

  // Check watch providers for all results in parallel
  const providerChecks = await Promise.allSettled(
    searchResults.map(async (r) => {
      const prov =
        r.media_type === "movie"
          ? await getMovieWatchProviders(r.id)
          : await getTVWatchProviders(r.id);
      const rd = prov.results[region.toUpperCase()] ?? null;
      const streaming = rd?.flatrate?.map((p) => p.provider_name) ?? [];
      const rentOptions = rd?.rent?.map((p) => p.provider_name) ?? [];
      const altTitle = r.title ?? r.name ?? "Unknown";
      const altYear = r.release_date
        ? new Date(r.release_date).getFullYear()
        : r.first_air_date
        ? new Date(r.first_air_date).getFullYear()
        : null;
      const onSubscription = streaming.some((s) => userSubscriptions.includes(s));
      return { title: altTitle, year: altYear, type: r.media_type === "tv" ? "TV Show" : "Movie", streaming, rentOptions, onSubscription };
    })
  );

  // Keep only ones with streaming options, sort subscription-first
  const streamingOptions = providerChecks
    .filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ streaming: string[] }>).value.streaming.length > 0)
    .map((r) => (r as PromiseFulfilledResult<typeof streamingOptions[0]>).value)
    .sort((a, b) => (b.onSubscription ? 1 : 0) - (a.onSubscription ? 1 : 0))
    .slice(0, 4);

  if (streamingOptions.length === 0) {
    return `I found some ${searchQuery.replace("best ", "")} but none are currently streaming in your region (${region}). They may be available to rent.`;
  }

  // Format with AI
  const subNote =
    userSubscriptions.length > 0
      ? `The user subscribes to: ${userSubscriptions.join(", ")}. Mark titles on their subscriptions with ✅.`
      : "";

  const formatResult = await generateText({
    model: getModel(),
    system:
      `You write short, personalized streaming recommendations. Given streaming options matching the user's mood, ` +
      `write a conversational reply (4–6 lines max). ${subNote}\n\n` +
      `RULES:\n` +
      `- Lead with any title on the user's subscriptions (prefix it with ✅)\n` +
      `- Mention 2–3 titles max\n` +
      `- Format each: "[Title] ([Year]) — [Platform]. One sentence on why it fits their mood."\n` +
      `- Match your description tone to the user's mood (scary request → atmospheric language)\n` +
      `- End with: "_Want something different? Just describe another mood._"\n` +
      `- No numbered lists, no markdown headers`,
    messages: [
      {
        role: "user",
        content: `User wants: "${userQuery}"\n\nCurrently streaming: ${JSON.stringify(streamingOptions.slice(0, 3))}`,
      },
    ],
    maxOutputTokens: MODEL_CONFIG.maxTokens,
    temperature: 0.3,
    maxRetries: 0,
  });

  const raw = formatResult.text ?? "";
  const clean = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .trim();

  return (
    clean ||
    streamingOptions
      .slice(0, 3)
      .map((o) => `${o.title} (${o.year ?? "?"}) — ${o.streaming[0]}`)
      .join("\n")
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function handlePick(
  extracted: string,
  messages: AgentMessage[],
  region: string
): Promise<string> {
  const pickNum = parseInt(extracted.replace("PICK:", ""), 10) - 1;

  const prevAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && /\d+\.\s+/.test(m.content));
  if (!prevAssistant) return "I lost track of the options. Could you repeat the title?";

  let lines = prevAssistant.content.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  if (lines.length === 0) {
    lines = Array.from(
      prevAssistant.content.matchAll(/(\d+\.\s+.+?)(?=\s{2,}\d+\.|\s*Reply|$)/g),
      (m) => m[1].trim()
    );
  }
  const picked = lines[pickNum];
  if (!picked) return "I couldn't match that number to the list. Could you name the title directly?";

  const titleMatch = picked.match(/^\d+\.\s+(.+?)(?:\s+\(\d{4}\))?(?:\s+—|$)/);
  if (!titleMatch) return "I couldn't read that choice. Could you name the title directly?";

  const knownTitle = titleMatch[1].trim();
  const yearMatch = picked.match(/\((\d{4})\)/);
  const knownYear = yearMatch ? parseInt(yearMatch[1]) : null;
  const knownMediaType = picked.includes("TV Show") ? "tv" : "movie";
  console.log("[agent] pick resolved:", knownTitle, knownYear, knownMediaType);

  return runAgent(messages, {
    region,
    _knownTitle: knownTitle,
    _knownYear: knownYear,
    _knownMediaType: knownMediaType,
  });
}

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
    return `${label}\n\nNot currently available for streaming in ${region}.\n\n_Availability from TMDB · may have changed._`;
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

  lines.push("\n_Availability from TMDB · may have changed._");
  return lines.join("\n");
}
