// ── /api/search ───────────────────────────────────────────────────────────────
// Direct (non-AI) title search via TMDB.
// Used for fast autocomplete and direct lookups — no AI agent involved.

import { NextRequest, NextResponse } from "next/server";
import { searchMulti, tmdbPosterUrl } from "@/lib/api/tmdb";
import { cacheOrFetch } from "@/lib/cache/client";
import { keys, TTL } from "@/lib/cache/keys";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (query.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const results = await cacheOrFetch(
      keys.tmdbSearch(query),
      TTL.SEARCH,
      async () => {
        const res = await searchMulti(query);
        return res.results
          .filter((r) => r.media_type !== "person")
          .slice(0, 8)
          .map((r) => ({
            tmdbId: r.id,
            mediaType: r.media_type,
            title: r.title ?? r.name ?? "Unknown",
            year: r.release_date
              ? new Date(r.release_date).getFullYear()
              : r.first_air_date
              ? new Date(r.first_air_date).getFullYear()
              : null,
            posterUrl: tmdbPosterUrl(r.poster_path, "w185"),
            voteAverage: r.vote_average ?? null,
            overview: (r.overview ?? "").slice(0, 150),
          }));
      }
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Search temporarily unavailable" },
      { status: 503 }
    );
  }
}
