import { SearchBar } from "@/components/search/SearchBar";
import { ExampleChips } from "@/components/home/ExampleChips";
import { HeroSection } from "@/components/home/HeroSection";

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

      {/* ── Hero: clapperboard + greeting + tagline ── */}
      <div style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        marginBottom: 44,
        animation: "slide-up 0.55s ease both",
      }}>
        <HeroSection />
      </div>

      {/* ── Search bar ── */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 620,
        animation: "slide-up 0.55s 0.08s ease both",
        opacity: 0,
        animationFillMode: "forwards",
      }}>
        <SearchBar />
      </div>

      {/* ── Example chips ── */}
      <ExampleChips />

      {/* ── Footer ── */}
      <p style={{
        position: "relative", zIndex: 1,
        marginTop: 60, fontSize: 12, color: "var(--subtle)", textAlign: "center",
        animation: "fade-in 0.6s 0.3s ease both", opacity: 0, animationFillMode: "forwards",
      }}>
        Legal streaming sources only · Data from TMDB &amp; Watchmode
      </p>
    </main>
  );
}
