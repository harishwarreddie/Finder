"use client";

// ── SEARCH BAR (Gen Z redesign) ───────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function SearchBar({ initialValue = "" }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const isNL = /^(where|what|is|find|can i|how|show me)/i.test(query.trim());
    if (isNL) { setSuggestions([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSuggestionClick(s: SearchSuggestion) {
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(s.title)}&tmdbId=${s.tmdbId}&type=${s.mediaType}`);
  }

  const glowStyle = focused
    ? { boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 0 28px rgba(124,58,237,0.20), 0 0 56px rgba(236,72,153,0.10)" }
    : { boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.3)" };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <form onSubmit={handleSubmit} role="search">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: 20,
          padding: "14px 16px",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: focused ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.09)",
          transition: "border-color 0.25s, box-shadow 0.25s",
          ...glowStyle,
        }}>
          <SearchIcon focused={focused} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { setFocused(true); if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => { setFocused(false); setTimeout(() => setShowSuggestions(false), 150); }}
            placeholder="Search or ask anything — &quot;Where can I watch Dune?&quot;"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "var(--fg)",
              caretColor: "#a78bfa",
            }}
            aria-label="Search for entertainment content"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <SpinnerIcon />}
          <button
            type="submit"
            disabled={!query.trim()}
            style={{
              background: query.trim() ? "var(--grad-btn)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: query.trim() ? "pointer" : "not-allowed",
              opacity: query.trim() ? 1 : 0.45,
              transition: "background 0.2s, opacity 0.2s, transform 0.15s, box-shadow 0.2s",
              flexShrink: 0,
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => { if (query.trim()) (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(13,15,26,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.15)",
          zIndex: 50,
        }}>
          {suggestions.map((s, i) => (
            <button
              key={s.tmdbId}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              {s.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.posterUrl} alt="" style={{ width: 32, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 48, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", fontSize: 18 }}>🎬</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  {s.year && `${s.year} · `}{s.mediaType === "tv" ? "TV Show" : "Movie"}{s.voteAverage && s.voteAverage > 0 ? ` · ★ ${s.voteAverage.toFixed(1)}` : ""}
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
function SearchIcon({ focused }: { focused: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: focused ? "#a78bfa" : "var(--subtle)", flexShrink: 0, transition: "color 0.25s" }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ color: "#a78bfa", animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
