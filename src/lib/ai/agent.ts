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
  discoverMovies,
  getTrendingMovies,
  TMDB_PROVIDER_IDS,
  TMDB_GENRE_IDS,
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
  /\b(recommend|suggest( me)?|something (to watch|scary|funny|good|dark|light|short)|what (should|to|can i) watch|what.?s (free|on|available|streaming)|free to watch|available (to me|on|for)|in the mood (for|to)|feel like watching|find (me )?(a |some|something)|looking for (a |something)|any good (movies?|shows?|films?)|give me (a |some)|i (have|got|use|subscribe to) (netflix|prime|amazon|hulu|disney|max|apple|peacock|paramount|hbo)|what.?s good|what.?s (on|new))\b|^[\s\p{Emoji}]+$/iu;

// (GENRE_QUERY / extractSearchQuery replaced by extractGenreId + TMDB_GENRE_IDS —
//  genre detection now uses /discover/movie with a proper genre ID rather than
//  searching for "best horror movies" as a title string.)

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

    const isDominant = topPop > 15 && (!secondResult || topPop > secondPop * 3);

    // If the top result title is an exact match for what was extracted, just use it —
    // no vote threshold needed. TMDB's ranking already surfaces the most relevant result.
    const isExactMatch =
      (topResult.title ?? topResult.name ?? "").toLowerCase() === extracted.toLowerCase();

    // Also skip disambiguation when all alternatives share the same base title (franchise)
    const allShareBaseName = searchResults
      .slice(0, 4)
      .every((r) =>
        (r.title ?? r.name ?? "").toLowerCase().startsWith(extracted.toLowerCase())
      );

    const needsDisambiguation = namesAreDifferent && !isDominant && !isExactMatch && !allShareBaseName;

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

  // Detect intent modifiers that change how the answer is framed
  const isCheapestQuery = /\b(cheapest|cheapest way|under \$|budget|cheap|low.?cost|how much|price)\b/i.test(userQuestion);
  const cheapestNote = isCheapestQuery
    ? `\n\nThe user wants the cheapest option. Lead with rent/buy options if they exist (e.g. "Cheapest is to rent on [Platform]"). ` +
      `If it's included on a subscription, mention that as "best value if you already have [Service]". ` +
      `Note that exact prices vary — direct the user to check the platform for current pricing.`
    : "";

  const formatResult = await generateText({
    model: getModel(),
    system:
      `You write ultra-concise streaming availability answers. Speak directly to the user.\n\n` +
      `STRICT RULES:\n` +
      `1. Subscription check: if user subscriptions match a streaming platform → lead with "✅ [Title] is on [Service]!"\n` +
      `2. Default order: subscription → free → rent → buy. Show MAX 4 services total.\n` +
      `3. Skip any category that's empty — do not write empty lines or dashes.\n` +
      `4. If notAvailable is true → say "[Title] isn't streaming in [region] right now."\n` +
      `   - If rent/buy options exist → "But you can rent/buy on [platforms]."\n` +
      `   - If streamingAlternatives exist → "You might like [Title] instead — it's on [Platform]."\n` +
      `5. End EVERY response (unavailable or not) with this exact line: "_Availability from TMDB · may have changed._"\n` +
      `6. No markdown headers, no bullet dashes. Max 6 lines total. Be conversational, not robotic.` +
      subscriptionNote +
      cheapestNote,
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

// Detect if the user is asking about a specific streaming service.
// Returns { name, providerId } so we can filter discover results accurately.
const SERVICE_MAP: [RegExp, { name: string; providerId: number }][] = [
  [/\b(amazon|prime video|prime\b)/i, { name: "Amazon Prime Video", providerId: 9    }],
  [/\bnetflix\b/i,                    { name: "Netflix",             providerId: 8    }],
  [/\bhulu\b/i,                       { name: "Hulu",                providerId: 15   }],
  [/\b(disney\+?|disney plus)\b/i,    { name: "Disney Plus",         providerId: 337  }],
  [/\bmax\b/i,                        { name: "Max",                 providerId: 1899 }],
  [/\b(apple tv\+?|apple)\b/i,        { name: "Apple TV Plus",       providerId: 350  }],
  [/\bpeacock\b/i,                    { name: "Peacock",             providerId: 386  }],
  [/\b(paramount\+?|paramount plus)\b/i, { name: "Paramount Plus",   providerId: 531  }],
  [/\bhbo\b/i,                        { name: "Max",                 providerId: 1899 }],
];

function detectMentionedService(text: string): { name: string; providerId: number } | null {
  for (const [re, info] of SERVICE_MAP) {
    if (re.test(text)) return info;
  }
  return null;
}

// Keyword → TMDB genre ID for /discover/movie
function extractGenreId(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\b(horror|scary|spooky|creepy)\b/.test(lower))        return TMDB_GENRE_IDS.horror;
  if (/\b(comedy|funny|hilarious|laugh)\b/.test(lower))      return TMDB_GENRE_IDS.comedy;
  if (/\b(thriller|suspense|tense)\b/.test(lower))           return TMDB_GENRE_IDS.thriller;
  if (/\b(action|explosive|fight|superhero)\b/.test(lower))  return TMDB_GENRE_IDS.action;
  if (/\b(romance|romantic|love story)\b/.test(lower))       return TMDB_GENRE_IDS.romance;
  if (/\b(sci.?fi|science fiction|space)\b/.test(lower))     return TMDB_GENRE_IDS["sci-fi"];
  if (/\b(drama|emotional|heavy|intense)\b/.test(lower))     return TMDB_GENRE_IDS.drama;
  if (/\b(animated|animation|cartoon)\b/.test(lower))        return TMDB_GENRE_IDS.animation;
  if (/\b(documentary|docuseries|true story)\b/.test(lower)) return TMDB_GENRE_IDS.documentary;
  if (/\b(mystery|whodunit|detective)\b/.test(lower))        return TMDB_GENRE_IDS.mystery;
  if (/\b(crime|heist|gangster|mob)\b/.test(lower))          return TMDB_GENRE_IDS.crime;
  if (/\b(fantasy|magic|wizard)\b/.test(lower))              return TMDB_GENRE_IDS.fantasy;
  if (/\b(adventure|explore)\b/.test(lower))                 return TMDB_GENRE_IDS.adventure;
  if (/\b(family|kids|children)\b/.test(lower))              return TMDB_GENRE_IDS.family;
  return null;
}

async function runRecommendAgent(
  userQuery: string,
  options: { region: string; userSubscriptions: string[] }
): Promise<string> {
  const { region, userSubscriptions } = options;

  // Detect if user specified a service ("I have Prime — what's free?")
  const mentionedService = detectMentionedService(userQuery);
  const effectiveSubs = mentionedService
    ? [...new Set([...userSubscriptions, mentionedService.name])]
    : userSubscriptions;

  // Detect genre from the query
  const genreId = extractGenreId(userQuery);

  console.log(
    "[recommend] service:", mentionedService?.name ?? "none",
    "| genre:", genreId ?? "none",
    "| region:", region
  );

  // ── DISCOVERY STRATEGY ─────────────────────────────────────────────────────
  // 1. If a service was mentioned → use /discover/movie with provider filter
  //    (accurate: only returns titles actually available on that service in the region)
  // 2. If just a genre → use /discover/movie with genre filter
  // 3. Fallback → use /trending/movie/week (always has results)

  type RecommendItem = {
    title: string;
    year: number | null;
    type: string;
    streaming: string[];
    rentOptions: string[];
    onSubscription: boolean;
  };

  let discoverResults: Awaited<ReturnType<typeof discoverMovies>>["results"] = [];

  try {
    if (mentionedService) {
      // Primary: discover movies on this specific provider in the user's region
      const res = await discoverMovies({
        withWatchProviders: mentionedService.providerId,
        watchRegion:        region,
        withGenres:         genreId ?? undefined,
        sortBy:             "popularity.desc",
      });
      discoverResults = res.results.slice(0, 10);

      // If discover returned nothing (provider not in this region), fall back to popular
      if (discoverResults.length === 0) {
        const fallback = await getTrendingMovies("week");
        discoverResults = fallback.results.slice(0, 8);
      }
    } else if (genreId) {
      const res = await discoverMovies({ withGenres: genreId, watchRegion: region });
      discoverResults = res.results.slice(0, 10);
    } else {
      const res = await getTrendingMovies("week");
      discoverResults = res.results.slice(0, 8);
    }
  } catch {
    return "I had trouble finding recommendations right now. Please try again.";
  }

  if (discoverResults.length === 0) {
    if (mentionedService) {
      return `I couldn't find titles for ${mentionedService.name} in your region (${region}). Try asking for a genre — like "horror on Prime".`;
    }
    return "I couldn't find anything for that mood right now. Try a different genre?";
  }

  // ── PROVIDER CHECK ─────────────────────────────────────────────────────────
  // For discover results, we already know the service (when mentionedService is set).
  // We still check providers to get the full list of streaming options per title
  // and confirm availability for the format step.

  const providerChecks = await Promise.allSettled(
    discoverResults.map(async (r): Promise<RecommendItem> => {
      const mediaType = (r.media_type ?? "movie") as "movie" | "tv";
      const prov =
        mediaType === "movie"
          ? await getMovieWatchProviders(r.id)
          : await getTVWatchProviders(r.id);
      const rd          = prov.results[region.toUpperCase()] ?? null;
      const streaming   = rd?.flatrate?.map((p) => p.provider_name) ?? [];
      const rentOptions = rd?.rent?.map((p) => p.provider_name) ?? [];
      const altTitle    = r.title ?? r.name ?? "Unknown";
      const altYear     = r.release_date
        ? new Date(r.release_date).getFullYear()
        : r.first_air_date
        ? new Date(r.first_air_date).getFullYear()
        : null;
      const onSubscription = streaming.some((s) =>
        effectiveSubs.some((sub) => s.toLowerCase().includes(sub.toLowerCase().split(" ")[0]))
      );
      return { title: altTitle, year: altYear, type: mediaType === "tv" ? "TV Show" : "Movie", streaming, rentOptions, onSubscription };
    })
  );

  const allOptions: RecommendItem[] = providerChecks
    .filter((r): r is PromiseFulfilledResult<RecommendItem> => r.status === "fulfilled")
    .map((r) => r.value);

  // When a service was specified via /discover, those results ARE on that service —
  // but the provider check confirms. Include results with any streaming option.
  const streamingOptions: RecommendItem[] = allOptions
    .filter((r) => r.streaming.length > 0 || mentionedService !== null)
    .sort((a, b) => (b.onSubscription ? 1 : 0) - (a.onSubscription ? 1 : 0))
    .slice(0, 4);

  const rentFallback: RecommendItem[] = allOptions
    .filter((r) => r.streaming.length === 0 && r.rentOptions.length > 0)
    .slice(0, 3);

  if (streamingOptions.length === 0 && rentFallback.length === 0) {
    if (mentionedService) {
      return `Couldn't confirm ${mentionedService.name} availability in ${region} right now. Check the app directly — TMDB provider data can lag.`;
    }
    return `Nothing came up for that mood in ${region} right now. Try a different genre?`;
  }

  // Format with AI
  const subNote =
    effectiveSubs.length > 0
      ? `The user has: ${effectiveSubs.join(", ")}. Mark titles on their services with ✅.`
      : "";

  const isRentOnly = streamingOptions.length === 0;
  const optionsToShow = isRentOnly ? rentFallback : streamingOptions.slice(0, 3);

  const availabilityNote = isRentOnly
    ? `None are on a subscription in ${region} right now — rent/buy only. Mention this naturally.`
    : mentionedService
    ? `These titles are available on ${mentionedService.name} in ${region}. Confirm that in your reply.`
    : "";

  const formatResult = await generateText({
    model: getModel(),
    system:
      `You write short, personalized streaming recommendations. Given options matching the user's mood, ` +
      `write a conversational reply (4–6 lines max). ${subNote} ${availabilityNote}\n\n` +
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
        content: `User wants: "${userQuery}"\n\nOptions: ${JSON.stringify(optionsToShow)}`,
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
