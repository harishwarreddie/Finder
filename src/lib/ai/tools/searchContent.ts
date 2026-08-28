// ── TOOL: search_content ──────────────────────────────────────────────────────
// Searches TMDB for movies and TV shows matching the query.
// Returns a list of candidates for disambiguation or direct use.
//
// WHY no Redis cache here:
//   tmdbFetch() already uses Next.js built-in fetch cache (next: { revalidate: 3600 }),
//   so repeated searches for the same query are automatically cached at the
//   framework level. Adding Redis on top would cause ~18s of extra latency when
//   Redis is unavailable (two ~9s network timeouts per call).

import { tool } from "ai";
import { z } from "zod";
import { searchMulti, searchMovies, searchTVShows, tmdbPosterUrl } from "@/lib/api/tmdb";

const searchContentSchema = z.object({
  query: z.string().describe("The search query — a title, description, or keywords."),
  type: z
    .enum(["movie", "tv", "all"])
    .optional()
    .default("all")
    .describe("Content type filter. Use 'all' when unsure."),
  year: z
    .number()
    .optional()
    .describe("Release year to narrow results for ambiguous titles like 'Batman'."),
});

export const searchContent = tool({
  description:
    "Search for movies, TV shows, or other entertainment content by title or description. " +
    "Returns a list of matching titles with basic metadata. Use this first to identify " +
    "the correct title before fetching availability.",
  inputSchema: searchContentSchema,
  execute: async ({ query, type = "all", year }: z.infer<typeof searchContentSchema>) => {
    // Call TMDB directly — tmdbFetch() handles Next.js-level caching internally
    let results;

    if (type === "movie") {
      const res = await searchMovies(query, { year });
      results = res.results.slice(0, 5);
    } else if (type === "tv") {
      const res = await searchTVShows(query, {
        first_air_date_year: year,
      });
      results = res.results.slice(0, 5);
    } else {
      const res = await searchMulti(query);
      results = res.results
        .filter((r) => r.media_type !== "person")
        .slice(0, 5);
    }

    return results.map((r) => ({
      tmdbId: r.id,
      mediaType: r.media_type,
      title: r.title ?? r.name ?? "Unknown",
      year: r.release_date
        ? new Date(r.release_date).getFullYear()
        : r.first_air_date
        ? new Date(r.first_air_date).getFullYear()
        : null,
      overview: r.overview?.slice(0, 200) ?? null,
      posterUrl: tmdbPosterUrl(r.poster_path, "w185"),
      voteAverage: r.vote_average ?? null,
    }));
  },
});
