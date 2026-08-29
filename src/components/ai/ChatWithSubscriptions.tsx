"use client";

// ── CHAT WITH SUBSCRIPTIONS ────────────────────────────────────────────────────
// Client wrapper that:
//  1. Auto-detects the user's region from navigator.language (falls back to "US")
//  2. Reads/writes subscription selections from localStorage (persists across sessions)
//  3. Renders the SubscriptionPicker above the chat
//  4. Passes selected subscriptions + region down to ChatPanel

import { useState, useEffect } from "react";
import { ChatPanel } from "./ChatPanel";
import { SubscriptionPicker } from "../home/SubscriptionPicker";

const STORAGE_KEY = "finder-subscriptions-v1";

// TMDB watch-provider regions with solid data coverage.
// If the browser reports a country not in this list we fall back to "US"
// rather than sending an unsupported code and getting empty results.
const SUPPORTED_REGIONS = new Set([
  "US", "GB", "CA", "AU", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "DK", "FI",
  "BR", "MX", "AR", "CL", "CO", "IN", "JP", "KR", "SG", "PH", "ID", "TH", "ZA",
  "PL", "PT", "TR", "RU", "UA", "CZ", "HU", "RO", "AT", "CH", "BE", "IE", "NZ",
]);

function detectRegion(): string {
  try {
    // navigator.languages is ordered by preference; first entry is most preferred
    const langs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language ?? "en-US"];

    for (const lang of langs) {
      // "en-GB" → "GB", "fr-FR" → "FR", "zh-Hans-CN" → "CN"
      const parts = lang.split("-");
      const country = parts[parts.length - 1]?.toUpperCase();
      if (country && country.length === 2 && SUPPORTED_REGIONS.has(country)) {
        return country;
      }
    }
  } catch {
    // navigator APIs may throw in some privacy/security contexts
  }
  return "US";
}

interface ChatWithSubscriptionsProps {
  initialQuery: string;
}

export function ChatWithSubscriptions({ initialQuery }: ChatWithSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [region, setRegion] = useState<string>("US");
  const [loaded, setLoaded] = useState(false);

  // Read localStorage + detect region on mount — both done client-side to avoid
  // hydration mismatches (server has no access to navigator or localStorage).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSubscriptions(JSON.parse(stored) as string[]);
    } catch { /* ignore quota/security errors */ }

    setRegion(detectRegion());
    setLoaded(true);
  }, []);

  function handleChange(subs: string[]) {
    setSubscriptions(subs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
    } catch { /* ignore */ }
  }

  // Don't render until localStorage is read — avoids flash of wrong state
  if (!loaded) return null;

  return (
    <div>
      <SubscriptionPicker selected={subscriptions} onChange={handleChange} />
      <ChatPanel
        initialQuery={initialQuery}
        region={region}
        subscriptions={subscriptions}
      />
    </div>
  );
}
