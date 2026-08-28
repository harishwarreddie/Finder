// ── CONTENT DETAIL PAGE ───────────────────────────────────────────────────────
// Route: /content/[id]  where id = "movie-550" or "tv-1396"
//
// WHY this page exists:
//   When a user searches "RRR" and clicks the result card, they shouldn't
//   get another AI chat window. They should land here — a proper detail page
//   with the poster, description, and a clear "where to watch" grid.
//
// HOW the id works:
//   "movie-550"  → type="movie", tmdbId=550   (Fight Club)
//   "tv-1396"    → type="tv",    tmdbId=1396  (Breaking Bad)
//   The search results page builds these slugs when linking here.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getMovie, getTVShow,
  getMovieWatchProviders, getTVWatchProviders,
  tmdbPosterUrl, tmdbBackdropUrl,
} from "@/lib/api/tmdb";
import { BackButton } from "@/components/ui/BackButton";

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface ContentPageProps {
  params: Promise<{ id: string }>;
}

// ── METADATA ──────────────────────────────────────────────────────────────────
// Next.js uses this to set <title> and <meta> tags for SEO.

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) return { title: "Not Found" };

  try {
    const details = parsed.type === "movie"
      ? await getMovie(parsed.tmdbId)
      : await getTVShow(parsed.tmdbId);
    const title = "title" in details ? details.title : details.name;
    return {
      title: `${title} — Where to Watch`,
      description: details.overview ?? undefined,
    };
  } catch {
    return { title: "Content" };
  }
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default async function ContentPage({ params }: ContentPageProps) {
  const { id } = await params;

  // Step 1: Parse the URL segment into type + tmdbId
  // What: "movie-550" becomes { type: "movie", tmdbId: 550 }
  // Why: we store both in one URL segment to keep routes clean
  const parsed = parseId(id);
  if (!parsed) notFound();

  const { type, tmdbId } = parsed;

  // Step 2: Fetch TMDB details — title, poster, backdrop, genres, overview
  // What: TMDB (The Movie Database) is a free API with rich metadata
  // Why: we need the poster image, description, and basic info to display
  let details: Awaited<ReturnType<typeof getMovie>> | Awaited<ReturnType<typeof getTVShow>>;
  try {
    details = type === "movie" ? await getMovie(tmdbId) : await getTVShow(tmdbId);
  } catch {
    notFound();
  }

  const title = "title" in details ? details.title : details.name;
  const overview = details.overview ?? null;
  const posterUrl = tmdbPosterUrl(details.poster_path, "w500");
  const backdropUrl = tmdbBackdropUrl(details.backdrop_path, "w1280");
  const rating = details.vote_average ?? null;
  const genres = details.genres ?? [];

  // Year + runtime differ between movies and TV shows
  const year = "release_date" in details && details.release_date
    ? new Date(details.release_date).getFullYear()
    : "first_air_date" in details && details.first_air_date
    ? new Date(details.first_air_date).getFullYear()
    : null;

  const runtime = "runtime" in details && details.runtime
    ? formatRuntime(details.runtime)
    : "number_of_seasons" in details && details.number_of_seasons
    ? `${details.number_of_seasons} Season${details.number_of_seasons !== 1 ? "s" : ""}`
    : null;

  // Step 3: Fetch streaming availability from TMDB Watch Providers
  // What: TMDB has its own watch provider database — no separate API key needed,
  //       no monthly request limit, and it includes platform logos.
  // Why we switched from Watchmode: Watchmode's free tier (1000 req/month) was
  //       silently failing. TMDB providers are unlimited and always accurate.
  // Trade-off: TMDB doesn't give us rental prices. We get platform + category only.
  //   Subscription (flatrate) = "included in your plan"
  //   Rent = "pay per view"
  //   Buy = "own it"
  //   Free = "free with ads"

  type TMDBProvider = { provider_id: number; provider_name: string; logo_path?: string };
  type GroupedAvailability = {
    provider: TMDBProvider;
    types: ("subscription" | "rent" | "buy" | "free")[];
    logoUrl: string | null;
    watchLink: string | null;
  };

  let watchLink: string | null = null;
  const providerMap = new Map<number, GroupedAvailability>();

  try {
    const providers = type === "movie"
      ? await getMovieWatchProviders(tmdbId)
      : await getTVWatchProviders(tmdbId);

    const us = providers.results["US"];
    if (us) {
      watchLink = us.link ?? null; // TMDB's affiliate link to JustWatch

      // Helper: add a provider to the map with its availability type
      const add = (p: TMDBProvider, avType: "subscription" | "rent" | "buy" | "free") => {
        if (!providerMap.has(p.provider_id)) {
          providerMap.set(p.provider_id, {
            provider: p,
            types: [],
            logoUrl: p.logo_path ? `https://image.tmdb.org/t/p/w45${p.logo_path}` : null,
            watchLink: us.link ?? null,
          });
        }
        providerMap.get(p.provider_id)!.types.push(avType);
      };

      us.flatrate?.forEach((p) => add(p, "subscription"));
      us.free?.forEach((p)     => add(p, "free"));
      us.rent?.forEach((p)     => add(p, "rent"));
      us.buy?.forEach((p)      => add(p, "buy"));
    }
  } catch {
    // TMDB provider failure is non-fatal — page still shows metadata
  }

  const allProviders = Array.from(providerMap.values());

  // Group by availability type for the UI
  const subscriptions = allProviders.filter((p) => p.types.includes("subscription"));
  const freeOptions   = allProviders.filter((p) => p.types.includes("free") && !p.types.includes("subscription"));
  const rentals       = allProviders.filter((p) => p.types.includes("rent"));
  const purchases     = allProviders.filter((p) => p.types.includes("buy"));

  const hasAvailability = allProviders.length > 0;

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      {/* The hero shows the backdrop image (wide landscape shot) behind the poster */}
      <div className="relative w-full" style={{ minHeight: 320 }}>

        {/* Backdrop — full-width cinematic image */}
        {backdropUrl ? (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backdropUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ opacity: 0.35 }}
            />
            {/* Gradient fades the bottom of the backdrop into the page background */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, transparent 40%, var(--background) 100%)",
              }}
            />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--surface-2)" }} />
        )}

        {/* Content over the backdrop */}
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-6">

          {/* Back button — client component (router.back() needs browser APIs) */}
          <BackButton />

          <div className="flex gap-6 items-end">
            {/* Poster */}
            <div
              className="flex-shrink-0 rounded-xl overflow-hidden shadow-2xl"
              style={{ width: 130, background: "var(--surface-2)" }}
            >
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl} alt={`${title} poster`} className="w-full h-auto" />
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ width: 130, height: 195, fontSize: 48 }}
                >
                  🎬
                </div>
              )}
            </div>

            {/* Title block */}
            <div className="flex-1 pb-2">
              <h1
                className="text-2xl sm:text-3xl font-bold leading-tight mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h1>

              {/* Meta row: year · type · runtime · rating */}
              <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
                {[
                  year,
                  type === "tv" ? "TV Show" : "Movie",
                  runtime,
                  rating && rating > 0 ? `★ ${rating.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {/* Genre tags */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.slice(0, 4).map((g) => (
                    <span
                      key={g.id}
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        background: "var(--surface-2)",
                        borderColor: "var(--border)",
                        color: "var(--muted)",
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-8">

        {/* ── WHERE TO WATCH ── */}
        {/* This is the main section — the whole reason this page exists */}
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--subtle)" }}
          >
            Where to Watch · US
          </h2>

          {!hasAvailability ? (
            <div
              className="px-5 py-6 rounded-xl border text-center"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--muted)",
              }}
            >
              <p className="font-medium mb-1">Not currently available for streaming</p>
              <p className="text-sm" style={{ color: "var(--subtle)" }}>
                This title wasn&apos;t found in our supported US streaming sources.
                Check back later — libraries change frequently.
              </p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* SUBSCRIPTION / INCLUDED */}
              {subscriptions.length > 0 && (
                <ProviderGroup label="Included in subscription" labelColor="var(--green)" items={subscriptions} />
              )}

              {/* FREE */}
              {freeOptions.length > 0 && (
                <ProviderGroup label="Free with ads" labelColor="var(--accent)" items={freeOptions} />
              )}

              {/* RENT */}
              {rentals.length > 0 && (
                <ProviderGroup label="Rent" labelColor="var(--orange)" items={rentals} />
              )}

              {/* BUY */}
              {purchases.length > 0 && (
                <ProviderGroup label="Buy" labelColor="var(--muted)" items={purchases} />
              )}

              {/* JustWatch attribution (TMDB requires this for watch provider data) */}
              <div className="flex items-center gap-2 pt-1">
                <p className="text-xs" style={{ color: "var(--subtle)" }}>
                  Streaming data provided by{" "}
                  {watchLink ? (
                    <a href={watchLink} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--accent)" }}>JustWatch</a>
                  ) : "JustWatch"}{" "}
                  via TMDB · US region
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── SYNOPSIS ── */}
        {overview && (
          <section>
            <h2
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--subtle)" }}
            >
              Synopsis
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {overview}
            </p>
          </section>
        )}

        {/* ── SEARCH AGAIN ── */}
        <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="/"
            className="text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            ← Search for another title
          </a>
        </div>
      </div>
    </div>
  );
}

// ── PROVIDER GROUP ────────────────────────────────────────────────────────────
// What: a labeled section with a row of platform cards (e.g. "Subscription")
// Why: grouping helps users instantly spot if it's on their plan vs paid

type ProviderEntry = {
  provider: { provider_id: number; provider_name: string; logo_path?: string };
  types: string[];
  logoUrl: string | null;
  watchLink: string | null;
};

function ProviderGroup({
  label,
  labelColor,
  items,
}: {
  label: string;
  labelColor: string;
  items: ProviderEntry[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: labelColor }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <ProviderCard key={item.provider.provider_id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── PROVIDER CARD ─────────────────────────────────────────────────────────────
// What: a clickable card showing one streaming platform
// Why: logo = instant recognition; clicking goes to the platform page

function ProviderCard({ item }: { item: ProviderEntry }) {
  const slug = item.provider.provider_name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const color = PLATFORM_COLOR[slug] ?? { bg: "var(--surface-2)", text: "var(--foreground)" };

  const card = (
    <div
      className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl min-w-[90px] text-center transition-opacity hover:opacity-80"
      style={{
        background: color.bg,
        color: color.text,
        border: color.bg === "var(--surface-2)" ? "1px solid var(--border)" : "none",
      }}
    >
      {/* Platform logo — TMDB provides these as 45px-wide images */}
      {item.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.logoUrl}
          alt={item.provider.provider_name}
          className="w-8 h-8 rounded-md object-contain"
        />
      ) : null}
      <span className="text-xs font-bold leading-tight">{item.provider.provider_name}</span>
    </div>
  );

  if (item.watchLink) {
    return (
      <a href={item.watchLink} target="_blank" rel="noopener noreferrer">
        {card}
      </a>
    );
  }

  return card;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Parse "movie-550" → { type: "movie", tmdbId: 550 } */
function parseId(id: string): { type: "movie" | "tv"; tmdbId: number } | null {
  const match = id.match(/^(movie|tv)-(\d+)$/);
  if (!match) return null;
  return { type: match[1] as "movie" | "tv", tmdbId: parseInt(match[2], 10) };
}

/** Convert minutes to "2h 22m" format */
function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── PLATFORM COLORS ───────────────────────────────────────────────────────────
// What: maps platform slugs to brand colors
// Why: users recognize Netflix by its red, Prime by its blue — color = instant recognition

const PLATFORM_COLOR: Record<string, { bg: string; text: string }> = {
  "netflix":          { bg: "#E50914", text: "#fff" },
  "prime-video":      { bg: "#00A8E1", text: "#fff" },
  "amazon-video":     { bg: "#00A8E1", text: "#fff" },
  "disney+":          { bg: "#113CCF", text: "#fff" },
  "disney-plus":      { bg: "#113CCF", text: "#fff" },
  "max":              { bg: "#002BE7", text: "#fff" },
  "hbo-max":          { bg: "#002BE7", text: "#fff" },
  "hulu":             { bg: "#1CE783", text: "#000" },
  "apple-tv+":        { bg: "#111",    text: "#fff" },
  "apple-tv-plus":    { bg: "#111",    text: "#fff" },
  "apple-tv":         { bg: "#111",    text: "#fff" },
  "peacock":          { bg: "#000",    text: "#fff" },
  "peacock-premium":  { bg: "#000",    text: "#fff" },
  "paramount+":       { bg: "#0064FF", text: "#fff" },
  "paramount-plus":   { bg: "#0064FF", text: "#fff" },
  "crunchyroll":      { bg: "#F47521", text: "#fff" },
  "tubi":             { bg: "#FF5500", text: "#fff" },
  "pluto-tv":         { bg: "#FFF200", text: "#000" },
  "youtube":          { bg: "#FF0000", text: "#fff" },
  "vudu":             { bg: "#3399FF", text: "#fff" },
  "fandango-home":    { bg: "#3399FF", text: "#fff" },
  "google-play":      { bg: "#34A853", text: "#fff" },
  "microsoft-store":  { bg: "#00A4EF", text: "#fff" },
};
