"use client";

// ── HERO SECTION ──────────────────────────────────────────────────────────────
// 3D clapperboard starts open. Snaps shut (with clap sound) when the user
// focuses the search bar. Multilingual greeting cycles automatically.

import { useState, useEffect, useRef } from "react";

const LANGS = [
  { greeting: "Hello, Cinephile",   label: "EN · English"  },
  { greeting: "Hola, Cinéfilo",     label: "ES · Español"  },
  { greeting: "Bonjour, Cinéphile", label: "FR · Français" },
  { greeting: "नमस्ते, सिनेप्रेमी",   label: "HI · हिन्दी"  },
];

function playClap() {
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.13);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.028));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio not available */ }
}

export function HeroSection() {
  const [idx,      setIdx]     = useState(0);
  const [fade,     setFade]    = useState(true);
  const [clamped,  setClamped] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const clampedRef = useRef(false);

  // Language cycling
  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % LANGS.length); setFade(true); }, 380);
    }, 3800);
    return () => clearInterval(iv);
  }, []);

  // Listen for search-bar focus → clap shut once
  useEffect(() => {
    function onClap() {
      if (clampedRef.current) return;
      clampedRef.current = true;
      setClamped(true);
      playClap();
    }
    window.addEventListener("searchClap", onClap);
    return () => window.removeEventListener("searchClap", onClap);
  }, []);

  return (
    <>
      <style>{`
        @keyframes board-float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-10px); }
        }
        @keyframes board-spin-360 {
          0%   { transform: perspective(600px) rotateY(-10deg) rotateX(4deg); }
          100% { transform: perspective(600px) rotateY(350deg) rotateX(4deg); }
        }
      `}</style>

      {/* ── 3D Clapperboard ── */}
      {/* Outer: only translates up/down (no filter — avoids blur on 3D children) */}
      <div
        aria-hidden="true"
        style={{
          display: "inline-block",
          marginBottom: 28,
          animation: "board-float 5.5s ease-in-out infinite",
        }}
      >
        {/* Inner: 3D perspective tilt — hover triggers full 360 spin */}
        <div
          style={{
            transform: spinning ? undefined : "perspective(600px) rotateY(-10deg) rotateX(4deg)",
            transformStyle: "preserve-3d",
            animation: spinning ? "board-spin-360 0.65s cubic-bezier(0.4,0,0.2,1) forwards" : "none",
            cursor: "pointer",
          }}
          onMouseEnter={() => { if (!spinning) setSpinning(true); }}
          onAnimationEnd={() => setSpinning(false)}
        >
          {/* Clapper flap — starts OPEN (rotateX -40deg), snaps shut on clap */}
          <div style={{
            width: 170,
            height: 42,
            borderRadius: "8px 8px 0 0",
            overflow: "hidden",
            transformOrigin: "bottom center",
            transformStyle: "preserve-3d",
            transform: clamped ? "rotateX(0deg)" : "rotateX(-40deg)",
            transition: clamped ? "transform 0.1s cubic-bezier(0.22,0,0.36,1)" : "none",
            position: "relative",
            zIndex: 2,
            background: `repeating-linear-gradient(
              -52deg,
              #efefef 0px, #efefef 11px,
              #111111 11px, #111111 22px
            )`,
            border: "2px solid rgba(255,255,255,0.25)",
            borderBottom: "2px solid rgba(255,255,255,0.10)",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.5)",
          }}>
            {/* Colour bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 8,
              background: "linear-gradient(90deg, #e53e3e 33%, #f6c90e 33% 66%, #38a169 66%)",
              borderRadius: "6px 6px 0 0",
            }} />
          </div>

          {/* Board body */}
          <div style={{
            width: 170,
            background: "linear-gradient(165deg, #1e1e3a 0%, #0f0f22 100%)",
            border: "2px solid rgba(255,255,255,0.11)",
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            padding: "12px 14px 14px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06)," +
              "0 20px 40px rgba(0,0,0,0.7)," +
              "0 0 0 1px rgba(124,58,237,0.10)",
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
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                padding: "5px 0",
                fontSize: 9.5,
                letterSpacing: "0.07em",
              }}>
                <span style={{ color: "rgba(255,255,255,0.30)", fontWeight: 700 }}>{lbl}</span>
                <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontFamily: "monospace", fontSize: 10 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cycling greeting ── */}
      <h1 style={{
        fontSize: "clamp(1.5rem, 4.5vw, 2.7rem)",
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1.08,
        color: "var(--fg)",
        marginBottom: 8,
        textWrap: "balance",
        opacity: fade ? 1 : 0,
        transform: fade ? "translateY(0)" : "translateY(5px)",
        transition: "opacity 0.32s ease, transform 0.32s ease",
        minHeight: "1.15em",
      } as React.CSSProperties}>
        {LANGS[idx].greeting}
      </h1>

      {/* Lang label */}
      <p style={{
        fontSize: 10,
        color: "var(--subtle)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 18,
        opacity: fade ? 1 : 0,
        transition: "opacity 0.32s ease",
      }}>
        {LANGS[idx].label}
      </p>

      {/* ── Tagline ── */}
      <p style={{
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.5,
        maxWidth: 380,
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
