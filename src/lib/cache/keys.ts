// ── CACHE KEYS ────────────────────────────────────────────────────────────────
// Centralized key generation. ALL cache keys are defined here.
// Format: {namespace}:{identifier}:{variant}
// This prevents key collisions and makes cache debugging easy.

/** TTL constants in seconds */
export const TTL = {
  /** TMDB movie/TV metadata — rarely changes */
  METADATA: 60 * 60 * 24 * 7, // 7 days

  /** Streaming availability — can change when licensing shifts */
  AVAILABILITY: 60 * 60 * 8, // 8 hours

  /** Rental/purchase prices */
  PRICES: 60 * 60 * 24, // 24 hours

  /** Search autocomplete results */
  SEARCH: 60 * 60, // 1 hour

  /** Platform catalog */
  PLATFORMS: 60 * 60 * 24 * 30, // 30 days

  /** Rate limiting window */
  RATE_LIMIT: 60, // 1 minute
} as const;

/** Cache key builders */
export const keys = {
  // TMDB metadata cache
  tmdbMovie: (tmdbId: number) => `tmdb:movie:${tmdbId}`,
  tmdbTV: (tmdbId: number) => `tmdb:tv:${tmdbId}`,
  tmdbSearch: (query: string) => `tmdb:search:${encodeURIComponent(query.toLowerCase().trim())}`,

  // Watchmode availability cache
  watchmodeId: (tmdbId: number, type: "movie" | "tv") => `watchmode:id:${type}:${tmdbId}`,
  availability: (contentId: string, region: string) =>
    `avail:${contentId}:${region.toUpperCase()}`,
  prices: (contentId: string, region: string) =>
    `prices:${contentId}:${region.toUpperCase()}`,

  // Platform catalog
  platforms: () => `platform:catalog`,
  platform: (slug: string) => `platform:${slug}`,

  // Rate limiting
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
} as const;
