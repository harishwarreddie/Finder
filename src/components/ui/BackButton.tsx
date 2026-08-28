"use client";

// ── BACK BUTTON ───────────────────────────────────────────────────────────────
// What: a client component that calls router.back() to go to the previous page
// Why: "javascript:history.back()" is blocked by React as a security measure.
//      Any browser navigation (history, scroll, location) needs "use client"
//      because those APIs only exist in the browser, not on the server.

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm mb-6 px-3 py-1.5 rounded-full cursor-pointer"
      style={{
        background: "rgba(0,0,0,0.4)",
        color: "#fff",
        backdropFilter: "blur(8px)",
        border: "none",
      }}
    >
      ← Back
    </button>
  );
}
