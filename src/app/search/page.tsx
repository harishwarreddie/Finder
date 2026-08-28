// ── SEARCH PAGE ───────────────────────────────────────────────────────────────
// Server component. Handles both direct searches and AI-powered queries.
// For natural language queries, renders the AI chat interface.
// For direct searches, renders content cards with availability.

import type { Metadata } from "next";
import { SearchBar } from "@/components/search/SearchBar";
import { ChatWithSubscriptions } from "@/components/ai/ChatWithSubscriptions";
import { searchMulti, tmdbPosterUrl } from "@/lib/api/tmdb";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    tmdbId?: string;
    type?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q ?? "";
  return {
    title: q ? `"${q}"` : "Search",
  };
}

const NATURAL_LANGUAGE_PATTERNS = /^(where|what|is |find|can i|how|show me|i have|i want|give me|suggest)/i;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  if (!query) {
    return (
      <main style={{ position: "relative", minHeight: "100dvh", background: "var(--bg)", overflow: "hidden" }}>
        <Orbs />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "4rem 1rem" }}>
          <SearchBar />
          <p style={{ marginTop: 32, textAlign: "center", fontSize: 14, color: "var(--subtle)" }}>
            Enter a title or ask a question to get started.
          </p>
        </div>
      </main>
    );
  }

  const isNaturalLanguage = NATURAL_LANGUAGE_PATTERNS.test(query);

  return (
    <main style={{ position: "relative", minHeight: "100dvh", background: "var(--bg)", overflow: "hidden" }}>
      <Orbs />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        {/* Search bar at top */}
        <div style={{ marginBottom: 28 }}>
          <SearchBar initialValue={query} />
        </div>

        {isNaturalLanguage ? (
          <ChatWithSubscriptions initialQuery={query} />
        ) : (
          <DirectSearchResults query={query} />
        )}
      </div>
    </main>
  );
}

// ── BACKGROUND ORBS ───────────────────────────────────────────────────────────
function Orbs() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", top: "-5%", left: "5%",
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 68%)",
        filter: "blur(40px)",
        animation: "orb-float 9s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "40%", right: "0%",
        width: 340, height: 340, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 68%)",
        filter: "blur(40px)",
        animation: "orb-drift 13s ease-in-out infinite",
      }} />
    </div>
  );
}

// ── DIRECT SEARCH RESULTS ─────────────────────────────────────────────────────

async function DirectSearchResults({ query }: { query: string }) {
  let results: Array<{
    tmdbId: number;
    mediaType: string;
    title: string;
    year: number | null;
    overview: string | null;
    posterUrl: string | null;
    voteAverage: number | null;
  }> = [];

  try {
    const res = await searchMulti(query);
    results = res.results
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
        overview: r.overview?.slice(0, 200) ?? null,
        posterUrl: tmdbPosterUrl(r.poster_path, "w342"),
        voteAverage: r.vote_average ?? null,
      }));
  } catch {
    return (
      <div className="text-center py-16" style={{ color: "var(--muted)" }}>
        <p className="text-lg font-medium mb-2">Search unavailable</p>
        <p className="text-sm">Please check your TMDB API key and try again.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--muted)" }}>
        <p className="text-lg font-medium mb-2">No results for &ldquo;{query}&rdquo;</p>
        <p className="text-sm">
          Try a different spelling, or ask a question like{" "}
          <a
            href={`/search?q=${encodeURIComponent(`Where can I watch ${query}?`)}`}
            style={{ color: "var(--accent)" }}
          >
            &ldquo;Where can I watch {query}?&rdquo;
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
      </p>
      <div className="grid gap-4">
        {results.map((r) => (
          <a
            key={r.tmdbId}
            href={`/content/${r.mediaType}-${r.tmdbId}`}
            className="flex gap-4 p-4 rounded-xl border transition-colors group"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            {/* Poster */}
            <div className="flex-shrink-0 w-14 rounded-lg overflow-hidden"
              style={{ background: "var(--surface-2)" }}>
              {r.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.posterUrl}
                  alt={`${r.title} poster`}
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-14 h-20 flex items-center justify-center">
                  <span className="text-2xl">🎬</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2
                  className="font-semibold text-base leading-tight group-hover:underline"
                  style={{ color: "var(--foreground)" }}
                >
                  {r.title}
                </h2>
                {r.voteAverage && r.voteAverage > 0 && (
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--subtle)" }}>
                    ★ {r.voteAverage.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--subtle)" }}>
                {r.year && `${r.year} · `}
                {r.mediaType === "tv" ? "TV Show" : "Movie"}
              </p>
              {r.overview && (
                <p className="text-sm leading-relaxed line-clamp-2"
                  style={{ color: "var(--muted)" }}>
                  {r.overview}
                </p>
              )}
              <p className="text-xs mt-2 font-medium" style={{ color: "var(--accent)" }}>
                Find where to watch →
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
