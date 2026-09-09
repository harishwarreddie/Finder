// ── TMDB CLIENT ───────────────────────────────────────────────────────────────
// All TMDB API calls go through here. Fully typed, Zod-validated.
// TMDB base URL: https://api.themoviedb.org/3
// Docs: https://developer.themoviedb.org/docs

import { z } from "zod";
import {
  TMDBMovieSchema,
  TMDBTVShowSchema,
  TMDBSearchResponseSchema,
  TMDBWatchProvidersSchema,
  type TMDBMovie,
  type TMDBTVShow,
  type TMDBSearchResponse,
  type TMDBWatchProviders,
} from "./types";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getHeaders(): HeadersInit {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_ACCESS_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function tmdbFetch<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 3600 }, // Next.js cache: 1 hour
  });

  if (!res.ok) {
    throw new Error(`TMDB error ${res.status}: ${endpoint}`);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    console.error("TMDB schema mismatch:", parsed.error.flatten());
    throw new Error(`TMDB response schema mismatch for ${endpoint}`);
  }

  return parsed.data;
}

// ── PUBLIC POSTER URL BUILDER ─────────────────────────────────────────────────

export function tmdbPosterUrl(
  path: string | null | undefined,
  size: "w92" | "w185" | "w342" | "w500" | "w780" | "original" = "w500"
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

export function tmdbBackdropUrl(
  path: string | null | undefined,
  size: "w300" | "w780" | "w1280" | "original" = "w1280"
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

// ── SEARCH ────────────────────────────────────────────────────────────────────

/**
 * Multi-search: searches movies, TV shows, and people simultaneously.
 * Returns ranked results with media_type field.
 */
export async function searchMulti(
  query: string,
  options: { page?: number; region?: string } = {}
): Promise<TMDBSearchResponse> {
  return tmdbFetch(
    "/search/multi",
    TMDBSearchResponseSchema,
    {
      query,
      page: String(options.page ?? 1),
      ...(options.region && { region: options.region }),
    }
  );
}

/**
 * Movie-specific search. Use when the query is confirmed to be a movie.
 */
export async function searchMovies(
  query: string,
  options: { page?: number; year?: number } = {}
): Promise<TMDBSearchResponse> {
  return tmdbFetch(
    "/search/movie",
    TMDBSearchResponseSchema,
    {
      query,
      page: String(options.page ?? 1),
      ...(options.year && { year: String(options.year) }),
    }
  );
}

/**
 * TV show search.
 */
export async function searchTVShows(
  query: string,
  options: { page?: number; first_air_date_year?: number } = {}
): Promise<TMDBSearchResponse> {
  return tmdbFetch(
    "/search/tv",
    TMDBSearchResponseSchema,
    {
      query,
      page: String(options.page ?? 1),
      ...(options.first_air_date_year && {
        first_air_date_year: String(options.first_air_date_year),
      }),
    }
  );
}

// ── DETAIL ────────────────────────────────────────────────────────────────────

/**
 * Full movie details including genres, runtime, IMDB ID.
 */
export async function getMovie(tmdbId: number): Promise<TMDBMovie> {
  return tmdbFetch(
    `/movie/${tmdbId}`,
    TMDBMovieSchema,
    { append_to_response: "external_ids" }
  );
}

/**
 * Full TV show details including season/episode counts.
 */
export async function getTVShow(tmdbId: number): Promise<TMDBTVShow> {
  return tmdbFetch(
    `/tv/${tmdbId}`,
    TMDBTVShowSchema,
    { append_to_response: "external_ids" }
  );
}

// ── WATCH PROVIDERS ───────────────────────────────────────────────────────────

/**
 * TMDB watch providers — subscription only, no pricing data.
 * Use Watchmode for full rental/purchase data.
 * Returns provider lists keyed by region code.
 */
export async function getMovieWatchProviders(
  tmdbId: number
): Promise<TMDBWatchProviders> {
  return tmdbFetch(
    `/movie/${tmdbId}/watch/providers`,
    TMDBWatchProvidersSchema
  );
}

export async function getTVWatchProviders(
  tmdbId: number
): Promise<TMDBWatchProviders> {
  return tmdbFetch(
    `/tv/${tmdbId}/watch/providers`,
    TMDBWatchProvidersSchema
  );
}

// ── SIMILAR / RECOMMENDATIONS ─────────────────────────────────────────────────

export async function getSimilarMovies(
  tmdbId: number,
  page = 1
): Promise<TMDBSearchResponse> {
  return tmdbFetch(
    `/movie/${tmdbId}/similar`,
    TMDBSearchResponseSchema,
    { page: String(page) }
  );
}

export async function getSimilarTVShows(
  tmdbId: number,
  page = 1
): Promise<TMDBSearchResponse> {
  return tmdbFetch(
    `/tv/${tmdbId}/similar`,
    TMDBSearchResponseSchema,
    { page: String(page) }
  );
}

// ── GENRES ────────────────────────────────────────────────────────────────────

export async function getMovieGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  const schema = z.object({ genres: z.array(z.object({ id: z.number(), name: z.string() })) });
  return tmdbFetch("/genre/movie/list", schema);
}

export async function getTVGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  const schema = z.object({ genres: z.array(z.object({ id: z.number(), name: z.string() })) });
  return tmdbFetch("/genre/tv/list", schema);
}

// ── DISCOVER ──────────────────────────────────────────────────────────────────
// Use /discover/movie to find movies by watch provider, genre, region etc.
// Much more reliable than searchMulti for "what's on Netflix?" type queries.

/**
 * TMDB watch-provider IDs — consistent globally.
 * Used with /discover/movie?with_watch_providers=ID&watch_region=XX
 */
export const TMDB_PROVIDER_IDS: Record<string, number> = {
  "Netflix":             8,
  "Amazon Prime Video":  9,
  "Prime Video":         9,   // TMDB uses this name in some regions
  "Disney Plus":         337,
  "Disney+":             337,
  "Hulu":                15,
  "Max":                 1899,
  "HBO Max":             1899,
  "Apple TV Plus":       350,
  "Apple TV+":           350,
  "Peacock":             386,
  "Paramount Plus":      531,
  "Paramount+":          531,
};

/** TMDB genre IDs for /discover/movie */
export const TMDB_GENRE_IDS: Record<string, number> = {
  action:       28,
  adventure:    12,
  animation:    16,
  comedy:       35,
  crime:        80,
  documentary:  99,
  drama:        18,
  family:       10751,
  fantasy:      14,
  horror:       27,
  mystery:      9648,
  romance:      10749,
  "sci-fi":     878,
  scifi:        878,
  thriller:     53,
};

export async function discoverMovies(options: {
  withWatchProviders?: number;
  watchRegion?: string;
  withGenres?: number;
  sortBy?: string;
  page?: number;
}): Promise<TMDBSearchResponse> {
  const params: Record<string, string> = {
    page:    String(options.page ?? 1),
    sort_by: options.sortBy ?? "popularity.desc",
  };
  if (options.withWatchProviders) {
    params.with_watch_providers         = String(options.withWatchProviders);
    params.with_watch_monetization_types = "flatrate|free";
  }
  if (options.watchRegion) params.watch_region = options.watchRegion;
  if (options.withGenres)  params.with_genres   = String(options.withGenres);

  // discoverMovies returns movie results — attach media_type manually after parsing
  const result = await tmdbFetch("/discover/movie", TMDBSearchResponseSchema, params);
  // Ensure media_type is set since /discover doesn't include it
  result.results = result.results.map((r) =>
    r.media_type ? r : { ...r, media_type: "movie" as const }
  );
  return result;
}

export async function getTrendingMovies(
  timeWindow: "day" | "week" = "week"
): Promise<TMDBSearchResponse> {
  return tmdbFetch(`/trending/movie/${timeWindow}`, TMDBSearchResponseSchema);
}
