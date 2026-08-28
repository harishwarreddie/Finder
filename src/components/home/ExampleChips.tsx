"use client";

const EXAMPLE_QUERIES = [
  "Where can I watch Oppenheimer?",
  "Is Interstellar on Netflix?",
  "Find me a thriller under $4",
  "Cheapest way to watch Dune?",
  "I have Prime — what's free?",
];

export function ExampleChips() {
  return (
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
  );
}
