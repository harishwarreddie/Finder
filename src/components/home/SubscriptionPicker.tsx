"use client";

// ── SUBSCRIPTION PICKER ────────────────────────────────────────────────────────
// Toggleable streaming service chips. Selected services are passed to the AI
// so it can highlight whether the title is on services the user already has.
//
// TMDB provider name → display label mapping.
// The values here must match what TMDB's watch-provider API returns exactly,
// so the AI can compare them to the flatrate/free arrays.

const SERVICES: { id: string; label: string; emoji: string }[] = [
  { id: "Netflix",             label: "Netflix",    emoji: "🔴" },
  { id: "Amazon Prime Video",  label: "Prime",      emoji: "🔵" },
  { id: "Hulu",                label: "Hulu",       emoji: "🟢" },
  { id: "Disney Plus",         label: "Disney+",    emoji: "🔷" },
  { id: "Max",                 label: "Max",        emoji: "🟣" },
  { id: "Apple TV Plus",       label: "Apple TV+",  emoji: "⬛" },
  { id: "Peacock",             label: "Peacock",    emoji: "🦚" },
  { id: "Paramount Plus",      label: "Paramount+", emoji: "⭐" },
];

interface SubscriptionPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SubscriptionPicker({ selected, onChange }: SubscriptionPickerProps) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, color: "var(--subtle)", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        My subscriptions
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SERVICES.map((svc) => {
          const on = selected.includes(svc.id);
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => toggle(svc.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                border: on
                  ? "1px solid rgba(124,58,237,0.6)"
                  : "1px solid rgba(255,255,255,0.10)",
                background: on
                  ? "rgba(124,58,237,0.18)"
                  : "rgba(255,255,255,0.04)",
                color: on ? "#c4b5fd" : "var(--muted)",
                boxShadow: on ? "0 0 12px rgba(124,58,237,0.2)" : "none",
              }}
              onMouseEnter={e => {
                if (!on) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "var(--fg)";
                }
              }}
              onMouseLeave={e => {
                if (!on) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                }
              }}
            >
              <span style={{ fontSize: 10 }}>{svc.emoji}</span>
              {svc.label}
              {on && <span style={{ fontSize: 10, opacity: 0.8 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
