"use client";

// ── AI CHAT PANEL ─────────────────────────────────────────────────────────────
// Multi-turn conversation UI for natural language streaming queries.
//
// HOW MULTI-TURN WORKS:
//   Every time the user sends a message, we pass the FULL conversation history
//   to the API — not just the latest message. This lets the AI remember what
//   was already said. For example:
//     User:  "Where can I watch Inception?"
//     AI:    "Which Inception? (2010 Nolan / 1980 Mongolian / ...)"
//     User:  "1"   ← the AI knows "1" means the 2010 Nolan film
//
//   The backend (/api/chat) already supported this — it accepts an array of
//   messages. We just weren't sending more than one from the frontend before.

import { useCallback, useEffect, useRef, useState } from "react";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface ChatPanelProps {
  initialQuery: string;
  region?: string;
  subscriptions?: string[];
}

// ── CHAT PANEL ────────────────────────────────────────────────────────────────

export function ChatPanel({
  initialQuery,
  region = "US",
  subscriptions = [],
}: ChatPanelProps) {
  // Full conversation history — both user and AI messages in order
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [input, setInput]           = useState("");

  const abortRef   = useRef<AbortController | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // ── callApi ────────────────────────────────────────────────────────────────
  // What: sends the full conversation history to /api/chat and appends the
  //       AI's reply to the messages list when it arrives.
  // Why full history: the AI needs to see previous turns to answer follow-ups.
  //   Sending only the latest message would make it forget the context.

  const callApi = useCallback(async (history: Message[]) => {
    // Cancel any in-flight request first (e.g. React Strict Mode double-mount)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, region, subscriptions }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({})) as { text?: string; error?: string };

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      // Append the AI reply to the conversation
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text ?? "No response received." },
      ]);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // Intentional — don't show error
      setError((err as Error).message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [region, subscriptions]);

  // Cleanup: abort any in-flight request when component unmounts
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Initial query ──────────────────────────────────────────────────────────
  // What: fires the first message on mount using the query from the URL.
  // Why no hasStarted guard: React 18 Strict Mode unmounts and remounts every
  //   component in development. The AbortController in callApi() cancels the
  //   first fetch on unmount; the second mount re-calls and completes.
  //   In production (no Strict Mode) this fires exactly once.

  useEffect(() => {
    const initial: Message[] = [{ role: "user", content: initialQuery }];
    setMessages(initial);
    callApi(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to the bottom whenever new content appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── handleSubmit ───────────────────────────────────────────────────────────
  // What: called when the user submits a follow-up message.
  // Why we compute newHistory synchronously:
  //   setState() is async — we can't call setMessages() and then immediately
  //   read the updated value. Instead, we build the new array before calling
  //   setMessages(), then pass that same array to callApi().

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;

      setInput("");

      // Build the updated history synchronously
      const newUserMsg: Message = { role: "user", content: text };
      const newHistory: Message[] = [...messages, newUserMsg];

      // Update the UI immediately (shows the user's message in the chat)
      setMessages(newHistory);

      // Send the full history to the AI
      await callApi(newHistory);

      // Return focus to input so the user can type again
      inputRef.current?.focus();
    },
    [input, isLoading, messages, callApi]
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────

  const hasAiReply = messages.some((m) => m.role === "assistant");

  return (
    <div className="flex flex-col gap-3">

      {/* ── MESSAGE BUBBLES ── */}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
            style={
              msg.role === "user"
                ? {
                    // User bubble: accent-tinted (right side)
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    fontWeight: 500,
                    borderBottomRightRadius: 4,
                  }
                : {
                    // AI bubble: neutral surface (left side)
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    whiteSpace: "pre-wrap",
                    borderBottomLeftRadius: 4,
                  }
            }
          >
            {msg.content}
          </div>
        </div>
      ))}

      {/* ── LOADING INDICATOR ── */}
      {isLoading && (
        <div className="flex justify-start">
          <div
            className="px-4 py-3 rounded-2xl border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderBottomLeftRadius: 4,
            }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--subtle)" }}>
              <LoadingDots />
              <span className="text-sm">Thinking…</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl border text-sm"
          style={{
            background: "var(--red-dim)",
            borderColor: "var(--red)",
            color: "var(--red)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── DATA ATTRIBUTION ── */}
      {!isLoading && hasAiReply && (
        <p className="text-xs text-center" style={{ color: "var(--subtle)" }}>
          Availability from Watchmode · Metadata from TMDB · {region} region
        </p>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />

      {/* ── FOLLOW-UP INPUT ── */}
      {/* What: a text box that appears below the conversation.
          Why: lets the user reply, disambiguate, or ask follow-ups without
               starting a new search. */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 pt-1 sticky bottom-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "Waiting for response…" : "Ask a follow-up…"}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
            opacity: isLoading ? 0.6 : 1,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── LOADING DOTS ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "var(--subtle)",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </span>
  );
}
