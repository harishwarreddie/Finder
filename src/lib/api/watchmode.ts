// ── WATCHMODE CLIENT ──────────────────────────────────────────────────────────
// Streaming availability, rental prices, and purchase prices.
// Docs: https://api.watchmode.com/docs
// Free tier: 1,000 requests/month. Upgrade at https://api.watchmode.com/pricing

import { z } from "zod";
import {
  WatchmodeSourceSchema,
  WatchmodeSearchResponseSchema,
  WatchmodeTitleSchema,
  type WatchmodeSource,
  type WatchmodeSearchResponse,
  type StreamingAvailability,
  type AvailabilityType,
} from "./types";

const BASE_URL = "https://api.watchmode.com/v1";

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.WATCHMODE_API_KEY;
  if (!key) throw new Error("WATCHMODE_API_KEY is not set");
  return key;
}

async function watchmodeFetch<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("apiKey", getApiKey());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 0 }, // Do NOT use Next.js cache — we handle caching in Redis
  });

  if (res.status === 429) {
    throw new Error("Watchmode rate limit exceeded. Check your plan at api.watchmode.com");
  }

  if (!res.ok) {
    throw new Error(`Watchmode error ${res.status}: ${endpoint}`);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    console.error("Watchmode schema mismatch:", parsed.error.flatten());
    throw new Error(`Watchmode response schema mismatch for ${endpoint}`);
  }

  return parsed.data;
}

// ── SEARCH ────────────────────────────────────────────────────────────────────

/**
 * Search Watchmode by title name. Returns Watchmode title IDs we can use
 * to fetch availability. Prefer using tmdb_id lookup when available.
 */
export async function searchWatchmodeTitle(
  query: string,
  types: string = "movie,tv_series,tv_miniseries"
): Promise<WatchmodeSearchResponse> {
  return watchmodeFetch(
    "/search/",
    WatchmodeSearchResponseSchema,
    { search_field: "name", search_value: query, types }
  );
}

/**
 * Find a Watchmode title by TMDB ID + type.
 * Much more reliable than name search — use when TMDB ID is known.
 */
export async function findByTmdbId(
  tmdbId: number,
  type: "movie" | "tv" = "movie"
): Promise<z.infer<typeof WatchmodeTitleSchema> | null> {
  const schema = z.array(WatchmodeTitleSchema);
  try {
    const results = await watchmodeFetch(
      "/search/",
      schema,
      {
        search_field: "tmdb_id",
        search_value: String(tmdbId),
        types: type === "tv" ? "tv_series,tv_miniseries" : "movie",
      }
    );
    return results[0] ?? null;
  } catch {
    return null;
  }
}

// ── AVAILABILITY ──────────────────────────────────────────────────────────────

const SourcesArraySchema = z.array(WatchmodeSourceSchema);

/**
 * Get all streaming sources for a Watchmode title ID.
 * This is the primary availability call — filter by region after.
 *
 * @param watchmodeId - Watchmode internal title ID
 * @param regions - ISO 3166-1 codes, comma-separated. Default "US"
 */
export async function getSources(
  watchmodeId: number,
  regions: string = "US"
): Promise<WatchmodeSource[]> {
  return watchmodeFetch(
    `/title/${watchmodeId}/sources/`,
    SourcesArraySchema,
    { regions, include_all_orgs: "true" }
  );
}

// ── NORMALIZERS ───────────────────────────────────────────────────────────────

/**
 * Map Watchmode source type string to our AvailabilityType enum.
 */
function mapSourceType(type: WatchmodeSource["type"]): AvailabilityType {
  switch (type) {
    case "sub":      return "subscription";
    case "rent":     return "rent";
    case "buy":      return "buy";
    case "free-web": return "free";
    case "tve":      return "addon"; // TV Everywhere — requires cable/addon subscription
    default:         return "subscription";
  }
}

/**
 * Convert raw Watchmode sources to our normalized StreamingAvailability format.
 * Filters to the requested region and deduplicates (highest quality per platform per type).
 */
export function normalizeSources(
  sources: WatchmodeSource[],
  region: string,
  platformMap: Record<number, { id: string; name: string; slug: string; logoUrl: string | null }>
): StreamingAvailability[] {
  const now = new Date().toISOString();
  const seen = new Set<string>(); // key: platformSlug+availabilityType
  const result: StreamingAvailability[] = [];

  for (const source of sources) {
    if (source.region.toUpperCase() !== region.toUpperCase()) continue;

    const platform = platformMap[source.source_id];
    if (!platform) continue; // Unknown platform — skip

    const availabilityType = mapSourceType(source.type);
    const dedupeKey = `${platform.slug}::${availabilityType}`;

    if (seen.has(dedupeKey)) continue; // Keep first (highest quality returned first by Watchmode)
    seen.add(dedupeKey);

    result.push({
      platformId: platform.id,
      platformName: platform.name,
      platformSlug: platform.slug,
      logoUrl: platform.logoUrl,
      availabilityType,
      price: source.price ?? null,
      currency: "USD",
      quality: source.format ?? null,
      watchLink: source.web_url ?? null,
      lastCheckedAt: now,
      confidence: "confirmed",
    });
  }

  // Sort: subscription first, then free, then rent (cheapest first), then buy
  return result.sort((a, b) => {
    const order: AvailabilityType[] = ["subscription", "free", "rent", "buy", "addon"];
    const ai = order.indexOf(a.availabilityType);
    const bi = order.indexOf(b.availabilityType);
    if (ai !== bi) return ai - bi;
    // Within same type, sort by price ascending (null = subscription = 0)
    return (a.price ?? 0) - (b.price ?? 0);
  });
}
