// ── TOOL: get_streaming_availability ─────────────────────────────────────────
// Fetches streaming availability from TMDB Watch Providers (powered by JustWatch).
//
// WHY we switched from Watchmode to TMDB Watch Providers:
//   • Watchmode's findByTmdbId API was returning null for all titles due to a
//     response schema mismatch (the API wraps results in {title_results:[...]}).
//   • TMDB Watch Providers is unlimited, free, and always accurate — same data
//     that powers JustWatch.
//   • No Redis caching needed here: tmdbFetch() already uses Next.js built-in
//     cache (next: { revalidate: 3600 }), which is faster and doesn't require
//     a Redis connection.
//
// WHAT this tool returns:
//   • Which platforms have the title (subscription, free, rent, buy)
//   • Platform name + logo URL
//   • A JustWatch deep-link for the user to click through
//   • Region-specific data (US by default)

import { tool } from "ai";
import { z } from "zod";
import { getMovieWatchProviders, getTVWatchProviders } from "@/lib/api/tmdb";
import type { StreamingAvailability } from "@/lib/api/types";

// TMDB serves provider logos at this base URL in 45×45px
const LOGO_BASE = "https://image.tmdb.org/t/p/w45";

// ── INPUT SCHEMA ──────────────────────────────────────────────────────────────

const getStreamingAvailabilitySchema = z.object({
  tmdbId: z.number().describe("The TMDB ID of the title (from search_content results)."),
  mediaType: z
    .enum(["movie", "tv"])
    .describe("Whether this is a movie or TV show."),
  region: z
    .string()
    .length(2)
    .default("US")
    .describe("ISO 3166-1 alpha-2 country code. Default: US"),
});

// ── HELPER ────────────────────────────────────────────────────────────────────
// What: maps a TMDB provider list to our StreamingAvailability shape
// Why: centralises the conversion so flatrate/free/rent/buy all use the same logic

function mapProviders(
  list: Array<{ provider_id: number; provider_name: string; logo_path?: string }> | undefined,
  type: StreamingAvailability["availabilityType"],
  watchLink: string | null,
  lastChecked: string
): StreamingAvailability[] {
  return (list ?? []).map((p) => ({
    platformId: String(p.provider_id),
    platformName: p.provider_name,
    platformSlug: p.provider_name.toLowerCase().replace(/\s+/g, "-"),
    logoUrl: p.logo_path ? `${LOGO_BASE}${p.logo_path}` : null,
    availabilityType: type,
    price: null,        // TMDB doesn't carry price data; user clicks JustWatch link for exact price
    currency: "USD",
    quality: null,
    watchLink,          // JustWatch affiliate link from TMDB
    lastCheckedAt: lastChecked,
    confidence: "confirmed" as const,
  }));
}

// ── TOOL ──────────────────────────────────────────────────────────────────────

export const getStreamingAvailability = tool({
  description:
    "Get the current streaming availability for a movie or TV show. " +
    "Returns which platforms have it (subscription, rent, buy, free) and a JustWatch link. " +
    "Always call this after search_content to get real-time availability data. " +
    "NEVER assume or invent availability — only state what this tool returns.",
  inputSchema: getStreamingAvailabilitySchema,
  execute: async ({ tmdbId, mediaType, region }: z.infer<typeof getStreamingAvailabilitySchema>): Promise<{
    available: StreamingAvailability[];
    cheapestRental: StreamingAvailability | null;
    cheapestPurchase: StreamingAvailability | null;
    freeOptions: StreamingAvailability[];
    subscriptionOptions: StreamingAvailability[];
    region: string;
    lastChecked: string;
    dataSource: string;
    justWatchLink: string | null;
  }> => {
    // Fetch from TMDB — no Redis needed, Next.js already caches tmdbFetch() for 1h
    const providers = mediaType === "movie"
      ? await getMovieWatchProviders(tmdbId)
      : await getTVWatchProviders(tmdbId);

    // TMDB returns a map keyed by country code: { "US": {...}, "GB": {...}, ... }
    const regionData = providers.results[region.toUpperCase()] ?? null;

    const lastChecked = new Date().toISOString();
    const justWatchLink = regionData?.link ?? null;

    if (!regionData) {
      // Title genuinely not available in this region — tell the AI clearly so it can
      // report "not available in US" rather than guessing or hallucinating
      return {
        available: [],
        cheapestRental: null,
        cheapestPurchase: null,
        freeOptions: [],
        subscriptionOptions: [],
        region,
        lastChecked,
        dataSource: "TMDB / JustWatch",
        justWatchLink: null,
      };
    }

    // Map each category to StreamingAvailability objects
    // flatrate = subscription (Netflix, Prime, etc.)
    // free     = free with ads (Tubi, Pluto, etc.)
    // rent     = digital rental (Apple TV, Vudu, etc.)
    // buy      = digital purchase (permanent ownership)
    const availability: StreamingAvailability[] = [
      ...mapProviders(regionData.flatrate, "subscription", justWatchLink, lastChecked),
      ...mapProviders(regionData.free,     "free",         justWatchLink, lastChecked),
      ...mapProviders(regionData.rent,     "rent",         justWatchLink, lastChecked),
      ...mapProviders(regionData.buy,      "buy",          justWatchLink, lastChecked),
    ];

    const rentals   = availability.filter((a) => a.availabilityType === "rent");
    const purchases = availability.filter((a) => a.availabilityType === "buy");

    return {
      available: availability,
      // Rental/purchase cheapest: TMDB has no prices, so just return the first option.
      // The justWatchLink gives the user exact prices when they click through.
      cheapestRental:   rentals[0]   ?? null,
      cheapestPurchase: purchases[0] ?? null,
      freeOptions:      availability.filter((a) => a.availabilityType === "free"),
      subscriptionOptions: availability.filter(
        (a) => a.availabilityType === "subscription" || a.availabilityType === "addon"
      ),
      region,
      lastChecked,
      dataSource: "TMDB / JustWatch",
      justWatchLink,
    };
  },
});
