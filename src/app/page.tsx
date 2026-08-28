import { SearchBar } from "@/components/search/SearchBar";

const EXAMPLE_QUERIES = [
  "Where can I watch Oppenheimer?",
  "Is Interstellar on Netflix?",
  "Find me a thriller under $4",
  "Cheapest way to watch Dune?",
  "I have Prime — what&apos;s free?",
];

export default function HomePage() {
  return (
    <main
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "4rem 1rem",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      {/* ── Animated background orbs ── */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "8%", left: "12%",
          width: 560, height: 560, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 68%)",
          filter: "blur(48px)",
          animation: "orb-float 9s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "35%", right: "8%",
          width: 440, height: 440, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.16) 0%, transparent 68%)",
          filter: "blur(48px)",
          animation: "orb-drift 13s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "12%", left: "28%",
          width: 380, height: 380, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.13) 0%, transparent 68%)",
          filter: "blur(48px)",
          animation: "orb-spin 11s ease-in-out infinite reverse",
        }} />
        {/* subtle noise grain overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
          opacity: 0.4,
        }} />
      </div>

      {/* ── Brand ── */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 44, animation: "slide-up 0.55s ease both" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 30 }}>🎬</span>
          <span style={{
            fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em",
            background: "var(--grad-text)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            StreamFinder
          </span>
        </div>

        <h1 style={{
          fontSize: "clamp(2rem, 6vw, 3.8rem)",
          fontWeight: 900,
          letterSpacing: "-0.045em",
          lineHeight: 1.08,
          color: "var(--fg)",
          marginBottom: 18,
          textWrap: "balance",
        }}>
          where&apos;s it{" "}
          <span style={{
            background: "var(--grad-text)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            streaming?
          </span>
        </h1>

        <p style={{
          color: "var(--muted)",
          fontSize: 17,
          lineHeight: 1.6,
          maxWidth: 420,
          margin: "0 auto",
        }}>
          Ask in plain English — get streaming availability,
          rental prices, and the cheapest way to watch instantly.
        </p>
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 620, animation: "slide-up 0.55s 0.08s ease both", opacity: 0, animationFillMode: "forwards" }}>
        <SearchBar />
      </div>

      {/* ── Example chips ── */}
      <div style={{
        position: "relative", zIndex: 1,
        marginTop: 28,
        display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
        maxWidth: 640,
        animation: "slide-up 0.55s 0.16s ease both",
        opacity: 0, animationFillMode: "forwards",
      }}>
        {EXAMPLE_QUERIES.map((q) => (
          <a
            key={q}
            href={`/search?q=${encodeURIComponent(q)}`}
            style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: 9999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "var(--muted)",
              textDecoration: "none",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "color 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#c4b5fd";
              el.style.borderColor = "rgba(124,58,237,0.45)";
              el.style.background = "rgba(124,58,237,0.09)";
              el.style.boxShadow = "0 0 16px rgba(124,58,237,0.15)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "var(--muted)";
              el.style.borderColor = "rgba(255,255,255,0.10)";
              el.style.background = "rgba(255,255,255,0.04)";
              el.style.boxShadow = "none";
            }}
          >
            {q}
          </a>
        ))}
      </div>

      {/* ── Footer ── */}
      <p style={{
        position: "relative", zIndex: 1,
        marginTop: 60, fontSize: 12, color: "var(--subtle)", textAlign: "center",
        animation: "fade-in 0.6s 0.3s ease both", opacity: 0, animationFillMode: "forwards",
      }}>
        Legal streaming sources only · US region · Data from TMDB &amp; Watchmode
      </p>
    </main>
  );
}
