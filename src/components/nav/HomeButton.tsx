"use client";

// ── HOME BUTTON ───────────────────────────────────────────────────────────────
// Mini 3D clapperboard + "StreamFinder" — click to go back to the home page.

import { useState } from "react";

export function HomeButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href="/"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px 6px 8px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.09)",
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        textDecoration: "none",
        transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
        transform: hovered ? "scale(1.03)" : "scale(1)",
        boxShadow: hovered
          ? "0 0 0 1px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.12)"
          : "none",
        cursor: "pointer",
      }}
    >
      {/* Mini 3D clapperboard */}
      <div
        aria-hidden="true"
        style={{
          transform: "perspective(300px) rotateY(-12deg) rotateX(4deg)",
          transformStyle: "preserve-3d",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          flexShrink: 0,
        }}
      >
        {/* Clapper flap */}
        <div style={{
          width: 34,
          height: 11,
          borderRadius: "4px 4px 0 0",
          background: `repeating-linear-gradient(
            -52deg,
            #e8e8e8 0px, #e8e8e8 5px,
            #111111 5px, #111111 10px
          )`,
          border: "1.5px solid rgba(255,255,255,0.2)",
          borderBottom: "none",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Colour bar */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, #e53e3e 33%, #f6c90e 33% 66%, #38a169 66%)",
            borderRadius: "3px 3px 0 0",
          }} />
        </div>

        {/* Board body */}
        <div style={{
          width: 34,
          height: 22,
          background: "linear-gradient(160deg, #1e1e38, #0f0f22)",
          border: "1.5px solid rgba(255,255,255,0.10)",
          borderTop: "none",
          borderRadius: "0 0 5px 5px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
          padding: "2px 4px",
        }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 2,
              borderRadius: 1,
              background: i === 0 ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.12)",
            }} />
          ))}
        </div>
      </div>

      {/* WordMark */}
      <span style={{
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        background: "var(--grad-text)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}>
        StreamFinder
      </span>
    </a>
  );
}
