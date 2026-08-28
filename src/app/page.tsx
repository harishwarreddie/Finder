import { SearchBar } from "@/components/search/SearchBar";
import { ExampleChips } from "@/components/home/ExampleChips";

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
        } as React.CSSProperties}>
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

      {/* ── Example chips (client component for hover effects) ── */}
      <ExampleChips />

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
