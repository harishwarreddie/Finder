// ── API TYPES ─────────────────────────────────────────────────────────────────
// Zod schemas for all external API responses.
// All external data is validated here before touching the rest of the app.

import { z } from "zod";

// ── TMDB ──────────────────────────────────────────────────────────────────────

export const TMDBMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  runtime: z.number().nullable().optional(),
  status: z.string().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
  imdb_id: z.string().nullable().optional(),
  genres: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
  production_companies: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
});
export type TMDBMovie = z.infer<typeof TMDBMovieSchema>;

export const TMDBTVShowSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  first_air_date: z.string().optional(),
  last_air_date: z.string().optional(),
  status: z.string().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
  number_of_seasons: z.number().optional(),
  number_of_episodes: z.number().optional(),
  episode_run_time: z.array(z.number()).optional(),
  genres: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
  networks: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
});
export type TMDBTVShow = z.infer<typeof TMDBTVShowSchema>;

export const TMDBSearchResultSchema = z.object({
  id: z.number(),
  // What: .catch("person" as const) silently coerces unknown media_types to "person".
  // Why: TMDB occasionally returns new types (e.g. "collection") not in our enum.
  //      Without .catch(), Zod throws on any unexpected type and the whole search fails.
  //      Coercing to "person" means our .filter(r => r.media_type !== "person") in agent.ts
  //      discards those unknown results — no crash, no leaked garbage data.
  media_type: z.enum(["movie", "tv", "person"]).catch("person" as const),
  title: z.string().optional(),       // movies
  name: z.string().optional(),        // TV shows
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  vote_average: z.number().optional(),
});
export type TMDBSearchResult = z.infer<typeof TMDBSearchResultSchema>;

export const TMDBSearchResponseSchema = z.object({
  page: z.number(),
  results: z.array(TMDBSearchResultSchema),
  total_pages: z.number(),
  total_results: z.number(),
});
export type TMDBSearchResponse = z.infer<typeof TMDBSearchResponseSchema>;

export const TMDBWatchProvidersSchema = z.object({
  results: z.record(
    z.string(),
    z.object({
      link: z.string().optional(),
      flatrate: z
        .array(z.object({ provider_id: z.number(), provider_name: z.string(), logo_path: z.string().optional() }))
        .optional(),
      rent: z
        .array(z.object({ provider_id: z.number(), provider_name: z.string(), logo_path: z.string().optional() }))
        .optional(),
      buy: z
        .array(z.object({ provider_id: z.number(), provider_name: z.string(), logo_path: z.string().optional() }))
        .optional(),
      free: z
        .array(z.object({ provider_id: z.number(), provider_name: z.string(), logo_path: z.string().optional() }))
        .optional(),
    })
  ),
});
export type TMDBWatchProviders = z.infer<typeof TMDBWatchProvidersSchema>;

// ── WATCHMODE ─────────────────────────────────────────────────────────────────

export const WatchmodeSourceSchema = z.object({
  source_id: z.number(),
  name: z.string(),
  type: z.enum(["sub", "rent", "buy", "free-web", "tve"]),
  region: z.string(),
  ios_url: z.string().nullable().optional(),
  android_url: z.string().nullable().optional(),
  web_url: z.string().nullable().optional(),
  format: z.string().optional(),   // "HD", "4K", "SD"
  price: z.number().nullable().optional(),
  seasons: z.number().nullable().optional(),
  episodes: z.number().nullable().optional(),
});
export type WatchmodeSource = z.infer<typeof WatchmodeSourceSchema>;

export const WatchmodeTitleSchema = z.object({
  id: z.number(),
  title: z.string(),
  year: z.number().optional(),
  imdb_id: z.string().optional(),
  tmdb_id: z.number().optional(),
  tmdb_type: z.enum(["movie", "tv"]).optional(),
  type: z.enum(["movie", "tv_movie", "short_film", "tv_series", "tv_special", "tv_miniseries", "tv_documentary"]).optional(),
  poster: z.string().nullable().optional(),
  backdrop: z.string().nullable().optional(),
  original_language: z.string().optional(),
  rating: z.number().optional(),
  relevance_percentile: z.number().optional(),
});
export type WatchmodeTitle = z.infer<typeof WatchmodeTitleSchema>;

export const WatchmodeSearchResponseSchema = z.object({
  title_results: z.array(WatchmodeTitleSchema),
});
export type WatchmodeSearchResponse = z.infer<typeof WatchmodeSearchResponseSchema>;

// ── SHARED APP TYPES ──────────────────────────────────────────────────────────

export type AvailabilityType = "subscription" | "addon" | "rent" | "buy" | "free";

export interface StreamingAvailability {
  platformId: string;
  platformName: string;
  platformSlug: string;
  logoUrl: string | null;
  availabilityType: AvailabilityType;
  price: number | null;
  currency: string;
  quality: string | null;
  watchLink: string | null;
  lastCheckedAt: string; // ISO timestamp
  confidence: "confirmed" | "likely" | "unknown";
}

export interface ContentSummary {
  id: string;
  tmdbId: number | null;
  contentType: string;
  title: string;
  slug: string;
  overview: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  runtimeMins: number | null;
  voteAverage: number | null;
  genres: { id: number; name: string }[];
}

export interface ContentWithAvailability extends ContentSummary {
  availability: StreamingAvailability[];
  region: string;
  cheapestOption: StreamingAvailability | null;
  includedInSubscriptions: StreamingAvailability[];
}

export type SearchIntent =
  | "direct"        // "Interstellar"
  | "question"      // "Where can I watch Interstellar?"
  | "conditional"   // "I have Netflix, where can I watch..."
  | "discovery"     // "Find me a thriller under $4"
  | "comparison"    // "Netflix vs Prime for..."
  | "recommendation"; // "Something like Interstellar"
