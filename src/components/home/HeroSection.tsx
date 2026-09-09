"use client";

// ── HERO SECTION ──────────────────────────────────────────────────────────────
// Board + greeting side-by-side. Board tilts to follow the cursor.
// Snaps shut on search focus (sound plays every re-entry).

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
  const [idx,     setIdx]    = useState(0);
  const [fade,    setFade]   = useState(true);
  const [clamped, setClamped] = useState(false);
  const [tilt,    setTilt]   = useState({ x: 3, y: -10 });
  const clampedRef = useRef(false);

  // Language cycling
  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % LANGS.length); setFade(true); }, 380);
    }, 3800);
    return () => clearInterval(iv);
  }, []);

  // Clap sound + snap on every search-bar focus
  useEffect(() => {
    function onClap() {
      playClap(); // always play sound
      if (!clampedRef.current) {
        clampedRef.current = true;
        setClamped(true);
      }
    }
    window.addEventListener("searchClap", onClap);
    return () => window.removeEventListener("searchClap", onClap);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2);
    const dy = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2);
    setTilt({ x: dy * -14, y: dx * 22 });
  }

  function handleMouseLeave() {
    setTilt({ x: 3, y: -10 }); // ease back to default resting angle
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

        @keyframes board-float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-10px); }
        }
        .hero-row {
          display: flex;
          align-items: center;
          gap: 40px;
          justify-content: center;
        }
        @media (max-width: 560px) {
          .hero-row { flex-direction: column; gap: 24px; text-align: center; }
          .hero-text { align-items: center !important; text-align: center !important; }
        }
      `}</style>

      <div className="hero-row">

        {/* ── Left: 3D Clapperboard ── */}
        <div
          aria-hidden="true"
          style={{ animation: "board-float 5.5s ease-in-out infinite", flexShrink: 0 }}
        >
          <div
            style={{
              transform: `perspective(600px) rotateY(${tilt.y}deg) rotateX(${tilt.x}deg)`,
              transformStyle: "preserve-3d",
              transition: "transform 0.12s ease-out",
              cursor: "crosshair",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Clapper flap — starts OPEN, snaps shut on first search focus */}
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

        {/* ── Right: Greeting + tagline ── */}
        <div
          className="hero-text"
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}
        >
          {/* Cycling greeting */}
          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            color: "var(--fg)",
            marginBottom: 6,
            opacity: fade ? 1 : 0,
            transform: fade ? "translateY(0)" : "translateY(5px)",
            transition: "opacity 0.32s ease, transform 0.32s ease",
            minHeight: "1.15em",
            margin: 0,
          } as React.CSSProperties}>
            {LANGS[idx].greeting}
          </h1>

          {/* Lang label */}
          <p style={{
            fontSize: 10,
            color: "var(--subtle)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: "6px 0 16px",
            opacity: fade ? 1 : 0,
            transition: "opacity 0.32s ease",
          }}>
            {LANGS[idx].label}
          </p>

          {/* Gen Z bold tagline */}
          <p style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "clamp(1.3rem, 3vw, 2rem)",
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            margin: 0,
            background: "var(--grad-text)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          } as React.CSSProperties}>
            Came to find your next obsession?
          </p>
        </div>

      </div>
    </>
  );
}
