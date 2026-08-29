"use client";

// ── HERO SECTION ──────────────────────────────────────────────────────────────
// Animated 3D clapperboard + multilingual cycling greeting.
// Extracted as a client component so page.tsx stays a Server Component.

import { useState, useEffect } from "react";

const LANGS = [
  { greeting: "Hello, Cinephile",    label: "EN · English"  },
  { greeting: "Hola, Cinéfilo",      label: "ES · Español"  },
  { greeting: "Bonjour, Cinéphile",  label: "FR · Français" },
  { greeting: "नमस्ते, सिनेप्रेमी",    label: "HI · हिन्दी"  },
];

export function HeroSection() {
  const [idx,  setIdx]  = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % LANGS.length);
        setFade(true);
      }, 380);
    }, 3800);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {/* ── Keyframes injected once ── */}
      <style>{`
        @keyframes board-float {
          0%, 100% { transform: perspective(700px) rotateY(-10deg) rotateX(3deg) translateY(0px); }
          50%       { transform: perspective(700px) rotateY(-10deg) rotateX(3deg) translateY(-12px); }
        }
        @keyframes clap-snap {
          0%   { transform: rotateX(0deg); }
          7%   { transform: rotateX(-42deg); }
          17%  { transform: rotateX(5deg); }
          25%  { transform: rotateX(-10deg); }
          32%  { transform: rotateX(0deg); }
          100% { transform: rotateX(0deg); }
        }
        @keyframes hi-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── 3D Clapperboard ── */}
      <div
        aria-hidden="true"
        style={{
          display: "inline-block",
          marginBottom: 36,
          animation: "board-float 5.5s ease-in-out infinite",
          transformStyle: "preserve-3d",
          filter: "drop-shadow(0 32px 48px rgba(0,0,0,0.65))",
        }}
      >
        {/* Clapper flap */}
        <div style={{
          width: 220,
          height: 50,
          borderRadius: "10px 10px 0 0",
          overflow: "hidden",
          transformOrigin: "bottom center",
          transformStyle: "preserve-3d",
          animation: "clap-snap 4.5s ease-in-out 1.2s infinite",
          position: "relative",
          zIndex: 2,
          background: `repeating-linear-gradient(
            -52deg,
            #f5f5f5 0px, #f5f5f5 13px,
            #111113 13px, #111113 26px
          )`,
          border: "2px solid rgba(255,255,255,0.22)",
          borderBottom: "2.5px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -6px 16px rgba(0,0,0,0.45)",
        }}>
          {/* Colour bar at top */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 9,
            background: "linear-gradient(90deg, #e53e3e 33%, #f6c90e 33% 66%, #38a169 66%)",
            borderRadius: "8px 8px 0 0",
          }} />
        </div>

        {/* Board body */}
        <div style={{
          width: 220,
          background: "linear-gradient(165deg, #1e1e38 0%, #0f0f22 100%)",
          border: "2px solid rgba(255,255,255,0.12)",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: "14px 18px 16px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.07)," +
            "0 24px 48px rgba(0,0,0,0.55)," +
            "0 0 0 1px rgba(124,58,237,0.12)",
        }}>
          {[
            ["PRODUCTION", "StreamFinder"],
            ["SCENE",      "∞"],
            ["TAKE",       "01"],
            ["ROLL",       "A"],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              padding: "6px 0",
              fontSize: 10.5,
              letterSpacing: "0.07em",
            }}>
              <span style={{ color: "rgba(255,255,255,0.32)", fontWeight: 700 }}>{lbl}</span>
              <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cycling greeting ── */}
      <h1
        style={{
          fontSize: "clamp(2rem, 6vw, 3.75rem)",
          fontWeight: 900,
          letterSpacing: "-0.045em",
          lineHeight: 1.08,
          color: "var(--fg)",
          marginBottom: 10,
          textWrap: "balance",
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.32s ease, transform 0.32s ease",
          minHeight: "1.15em",
        } as React.CSSProperties}
      >
        {LANGS[idx].greeting}
      </h1>

      {/* Lang label */}
      <p style={{
        fontSize: 11,
        color: "var(--subtle)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 22,
        opacity: fade ? 1 : 0,
        transition: "opacity 0.32s ease",
      }}>
        {LANGS[idx].label}
      </p>

      {/* ── Tagline ── */}
      <p style={{
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.5,
        maxWidth: 400,
        margin: "0 auto",
        background: "var(--grad-text)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      } as React.CSSProperties}>
        Came to find your next obsession?
      </p>
    </>
  );
}
