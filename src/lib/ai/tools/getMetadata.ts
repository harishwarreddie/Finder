// ── TOOL: get_content_metadata ────────────────────────────────────────────────
// Fetches full TMDB metadata for a specific title.

// WHY no Redis: tmdbFetch() already caches via Next.js (next: { revalidate: 3600 }).
// Redis would add ~18s of timeout latency when unavailable — not worth it in dev.

import { tool } from "ai";
import { z } from "zod";
import { getMovie, getTVShow, tmdbPosterUrl, tmdbBackdropUrl } from "@/lib/api/tmdb";

const getContentMetadataSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID from search_content results."),
  mediaType: z.enum(["movie", "tv"]).describe("Whether this is a movie or TV show."),
});

export const getContentMetadata = tool({
  description:
    "Get full metadata for a movie or TV show: poster, description, genres, " +
    "runtime, cast, release year, and ratings. Use after search_content to get " +
    "complete details for a specific title.",
  inputSchema: getContentMetadataSchema,
  execute: async ({ tmdbId, mediaType }: z.infer<typeof getContentMetadataSchema>) => {
    if (mediaType === "movie") {
      const movie = await getMovie(tmdbId);

      return {
        tmdbId: movie.id,
        mediaType: "movie" as const,
        title: movie.title,
        overview: movie.overview ?? null,
        posterUrl: tmdbPosterUrl(movie.poster_path),
        backdropUrl: tmdbBackdropUrl(movie.backdrop_path),
        releaseYear: movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : null,
        runtimeMins: movie.runtime ?? null,
        status: movie.status ?? null,
        voteAverage: movie.vote_average ?? null,
        imdbId: movie.imdb_id ?? null,
        genres: movie.genres ?? [],
      };
    } else {
      const show = await getTVShow(tmdbId);

      return {
        tmdbId: show.id,
        mediaType: "tv" as const,
        title: show.name,
        overview: show.overview ?? null,
        posterUrl: tmdbPosterUrl(show.poster_path),
        backdropUrl: tmdbBackdropUrl(show.backdrop_path),
        releaseYear: show.first_air_date
          ? new Date(show.first_air_date).getFullYear()
          : null,
        runtimeMins: show.episode_run_time?.[0] ?? null,
        status: show.status ?? null,
        voteAverage: show.vote_average ?? null,
        numberOfSeasons: show.number_of_seasons ?? null,
        numberOfEpisodes: show.number_of_episodes ?? null,
        genres: show.genres ?? [],
      };
    }
  },
});
