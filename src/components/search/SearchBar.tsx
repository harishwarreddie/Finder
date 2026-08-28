"use client";

// ── SEARCH BAR ────────────────────────────────────────────────────────────────
// Handles both direct title search and natural language queries.
// Submits to /search?q=... for server-side rendering.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function SearchBar({ initialValue = "" }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Fetch autocomplete suggestions from /api/search
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Only fetch for direct title searches (no question words)
    const isNaturalLanguage = /^(where|what|is|find|can i|how|show me)/i.test(query.trim());
    if (isNaturalLanguage) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch {
        // Ignore autocomplete errors — user can still submit manually
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSuggestionClick(suggestion: SearchSuggestion) {
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(suggestion.title)}&tmdbId=${suggestion.tmdbId}&type=${suggestion.mediaType}`);
  }

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} role="search">
        <div
          className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-shadow focus-within:shadow-lg"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search for a movie, show, or ask a question…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-sm"
            style={{ color: "var(--foreground)" }}
            aria-label="Search for entertainment content"
            autoComplete="off"
            spellCheck="false"
          />
          {loading && <SpinnerIcon />}
          <button
            type="submit"
            disabled={!query.trim()}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl overflow-hidden z-50"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.tmdbId}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{ borderBottom: `1px solid var(--border)` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.posterUrl}
                  alt=""
                  className="w-8 h-12 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-12 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ background: "var(--surface-2)" }}>
                  <span className="text-lg">🎬</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
                  {s.title}
                </p>
                <p className="text-xs" style={{ color: "var(--subtle)" }}>
                  {s.year && `${s.year} · `}
                  {s.mediaType === "tv" ? "TV Show" : "Movie"}
                  {s.voteAverage && s.voteAverage > 0 && ` · ★ ${s.voteAverage.toFixed(1)}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface SearchSuggestion {
  tmdbId: number;
  mediaType: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
}

// ── ICONS ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: "var(--subtle)", flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ color: "var(--subtle)", animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
