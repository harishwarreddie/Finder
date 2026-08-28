"use client";

// ── CHAT WITH SUBSCRIPTIONS ────────────────────────────────────────────────────
// Client wrapper that:
//  1. Reads/writes subscription selections from localStorage (persists across sessions)
//  2. Renders the SubscriptionPicker above the chat
//  3. Passes selected subscriptions down to ChatPanel so the AI highlights them

import { useState, useEffect } from "react";
import { ChatPanel } from "./ChatPanel";
import { SubscriptionPicker } from "../home/SubscriptionPicker";

const STORAGE_KEY = "finder-subscriptions-v1";

interface ChatWithSubscriptionsProps {
  initialQuery: string;
  region?: string;
}

export function ChatWithSubscriptions({ initialQuery, region = "US" }: ChatWithSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Read from localStorage on mount — done client-side to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSubscriptions(JSON.parse(stored) as string[]);
    } catch { /* ignore quota/security errors */ }
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
