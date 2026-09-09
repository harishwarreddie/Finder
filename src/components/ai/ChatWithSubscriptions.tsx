"use client";

// ── CHAT WITH SUBSCRIPTIONS ────────────────────────────────────────────────────
// Client wrapper that:
//  1. Detects the user's region via IP geolocation (ipapi.co) — accurate worldwide
//  2. Falls back to navigator.language if IP geo fails
//  3. Lets the user override their region via a small pill in the UI
//  4. Reads/writes subscription selections from localStorage
//  5. Passes selected subscriptions + region down to ChatPanel

import { useState, useEffect, useRef } from "react";
import { ChatPanel } from "./ChatPanel";
import { SubscriptionPicker } from "../home/SubscriptionPicker";

const SUBS_KEY   = "finder-subscriptions-v1";
const REGION_KEY = "finder-region-v1";

// ── REGION DETECTION ───────────────────────────────────────────────────────────
// Strategy: IP geolocation is far more accurate than navigator.language
// (a Japanese user with an English browser gets "en-US" from navigator, but
//  the IP lookup correctly returns "JP"). We try IP first, fall back to navigator.

async function detectRegionFromIP(): Promise<string | null> {
  try {
    // ipapi.co returns a plain 2-letter country code — no auth needed, 1k free req/day
    const res = await fetch("https://ipapi.co/country/", {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const code = (await res.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

function detectRegionFromNavigator(): string | null {
  try {
    const langs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language ?? "en-US"];

    for (const lang of langs) {
      // "en-GB" → "GB", "fr-FR" → "FR", "zh-Hans-CN" → "CN"
      const parts  = lang.split("-");
      const country = parts[parts.length - 1]?.toUpperCase();
      if (country && /^[A-Z]{2}$/.test(country) && country !== "EN") {
        return country;
      }
    }
  } catch { /* navigator APIs may throw in some security contexts */ }
  return null;
}

// ── REGION NAMES (for display only) ───────────────────────────────────────────
const REGION_NAMES: Record<string, string> = {
  US:"United States", GB:"United Kingdom", CA:"Canada", AU:"Australia",
  DE:"Germany", FR:"France", IT:"Italy", ES:"Spain", NL:"Netherlands",
  SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", PL:"Poland",
  PT:"Portugal", AT:"Austria", CH:"Switzerland", BE:"Belgium", IE:"Ireland",
  BR:"Brazil", MX:"Mexico", AR:"Argentina", CL:"Chile", CO:"Colombia",
  IN:"India", JP:"Japan", KR:"South Korea", CN:"China", HK:"Hong Kong",
  TW:"Taiwan", SG:"Singapore", MY:"Malaysia", TH:"Thailand", ID:"Indonesia",
  PH:"Philippines", VN:"Vietnam", PK:"Pakistan", BD:"Bangladesh",
  ZA:"South Africa", NG:"Nigeria", KE:"Kenya", EG:"Egypt",
  AE:"UAE", SA:"Saudi Arabia", IL:"Israel", TR:"Turkey",
  RU:"Russia", UA:"Ukraine", CZ:"Czech Republic", HU:"Hungary",
  RO:"Romania", NZ:"New Zealand", SK:"Slovakia", HR:"Croatia",
};

interface ChatWithSubscriptionsProps {
  initialQuery: string;
}

export function ChatWithSubscriptions({ initialQuery }: ChatWithSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [region,        setRegion]        = useState<string>("US");
  const [loaded,        setLoaded]        = useState(false);
  const [editingRegion, setEditingRegion] = useState(false);
  const [regionInput,   setRegionInput]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      // 1. Load saved subscriptions
      try {
        const stored = localStorage.getItem(SUBS_KEY);
        if (stored) setSubscriptions(JSON.parse(stored) as string[]);
      } catch { /* ignore */ }

      // 2. Check for a user-saved region override first
      let resolved: string | null = null;
      try {
        resolved = localStorage.getItem(REGION_KEY);
      } catch { /* ignore */ }

      // 3. Otherwise detect: IP first, navigator fallback
      if (!resolved) {
        resolved = await detectRegionFromIP();
      }
      if (!resolved) {
        resolved = detectRegionFromNavigator();
      }

      if (resolved && /^[A-Z]{2}$/.test(resolved)) setRegion(resolved);
      setLoaded(true);
    })();
  }, []);

  // Focus input when editing opens
  useEffect(() => {
    if (editingRegion) setTimeout(() => inputRef.current?.focus(), 50);
  }, [editingRegion]);

  function handleSubsChange(subs: string[]) {
    setSubscriptions(subs);
    try { localStorage.setItem(SUBS_KEY, JSON.stringify(subs)); } catch { /* ignore */ }
  }

  function submitRegion() {
    const code = regionInput.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      setRegion(code);
      try { localStorage.setItem(REGION_KEY, code); } catch { /* ignore */ }
    }
    setEditingRegion(false);
    setRegionInput("");
  }

  if (!loaded) return null;

  const regionLabel = REGION_NAMES[region] ?? region;

  return (
    <div>
      {/* ── Region pill ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Region
        </span>
        {editingRegion ? (
          <form
            onSubmit={(e) => { e.preventDefault(); submitRegion(); }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <input
              ref={inputRef}
              value={regionInput}
              onChange={e => setRegionInput(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. JP"
              maxLength={2}
              style={{
                width: 48,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(124,58,237,0.5)",
                borderRadius: 6,
                color: "var(--fg)",
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 6px",
                outline: "none",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            />
            <button
              type="submit"
              style={{ fontSize: 11, color: "#a78bfa", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditingRegion(false); setRegionInput(""); }}
              style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setEditingRegion(true); setRegionInput(region); }}
            title={`Detecting from ${regionLabel} — click to change`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#c4b5fd",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.22)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.12)"}
          >
            🌍 {region}
            <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 2 }}>▾</span>
          </button>
        )}
        <span style={{ fontSize: 11, color: "var(--subtle)", opacity: 0.5 }}>
          {!editingRegion && regionLabel !== region ? regionLabel : ""}
        </span>
      </div>

      <SubscriptionPicker selected={subscriptions} onChange={handleSubsChange} />

      <ChatPanel
        initialQuery={initialQuery}
        region={region}
        subscriptions={subscriptions}
      />
    </div>
  );
}
