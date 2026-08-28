"use client";

// ── AI CHAT PANEL (Gen Z redesign) ────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; };

interface ChatPanelProps {
  initialQuery: string;
  region?: string;
  subscriptions?: string[];
}

export function ChatPanel({ initialQuery, region = "US", subscriptions = [] }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [input, setInput]         = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  const abortRef  = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const callApi = useCallback(async (history: Message[]) => {
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.text ?? "No response received." }]);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [region, subscriptions]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const initial: Message[] = [{ role: "user", content: initialQuery }];
    setMessages(initial);
    callApi(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    const newHistory: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newHistory);
    await callApi(newHistory);
    inputRef.current?.focus();
  }, [input, isLoading, messages, callApi]);

  const hasAiReply = messages.some((m) => m.role === "assistant");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── MESSAGE BUBBLES ── */}
      {messages.map((msg, i) => (
        <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
          {msg.role === "assistant" && (
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginRight: 8, marginTop: 2,
              background: "var(--grad-btn)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13,
            }}>✨</div>
          )}
          <div style={{
            maxWidth: "82%",
            padding: "12px 16px",
            borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
            fontSize: 14,
            lineHeight: 1.65,
            animation: msg.role === "user" ? "msg-right 0.25s ease both" : "msg-left 0.25s ease both",
            ...(msg.role === "user" ? {
              background: "var(--grad-btn)",
              color: "#fff",
              fontWeight: 500,
              boxShadow: "0 4px 20px rgba(124,58,237,0.25)",
            } : {
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderLeft: "2px solid rgba(167,139,250,0.5)",
              color: "var(--fg)",
              whiteSpace: "pre-wrap",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }),
          }}>
            {msg.content}
          </div>
        </div>
      ))}

      {/* ── LOADING ── */}
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "var(--grad-btn)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>✨</div>
          <div style={{
            padding: "14px 18px",
            borderRadius: "20px 20px 20px 4px",
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderLeft: "2px solid rgba(167,139,250,0.5)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <GlowDots />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Finding streams…</span>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 14,
          background: "var(--error-bg)",
          border: "1px solid rgba(244,63,94,0.3)",
          color: "var(--error)",
          fontSize: 14,
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── ATTRIBUTION ── */}
      {!isLoading && hasAiReply && (
        <p style={{ fontSize: 11, textAlign: "center", color: "var(--subtle)", margin: "4px 0" }}>
          Availability from Watchmode · Metadata from TMDB · {region} region
        </p>
      )}

      <div ref={bottomRef} />

      {/* ── FOLLOW-UP INPUT ── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex", gap: 8, paddingTop: 4,
          position: "sticky", bottom: 16,
        }}
      >
        <div style={{
          flex: 1,
          display: "flex",
          borderRadius: 16,
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: inputFocused ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.09)",
          boxShadow: inputFocused
            ? "0 0 0 1px rgba(124,58,237,0.3), 0 0 20px rgba(124,58,237,0.12)"
            : "0 2px 12px rgba(0,0,0,0.2)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          overflow: "hidden",
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={isLoading ? "Waiting for response…" : "Ask a follow-up…"}
            disabled={isLoading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "12px 16px",
              fontSize: 14,
              color: "var(--fg)",
              caretColor: "#a78bfa",
              opacity: isLoading ? 0.5 : 1,
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          style={{
            background: input.trim() && !isLoading ? "var(--grad-btn)" : "rgba(255,255,255,0.07)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "0 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
            opacity: input.trim() && !isLoading ? 1 : 0.4,
            transition: "background 0.2s, opacity 0.2s, transform 0.15s",
            letterSpacing: "-0.01em",
            boxShadow: input.trim() && !isLoading ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
          }}
          onMouseEnter={e => { if (input.trim() && !isLoading) (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── GLOW DOTS ─────────────────────────────────────────────────────────────────
function GlowDots() {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: i === 0 ? "#a78bfa" : i === 1 ? "#f472b6" : "#67e8f9",
          animation: `bounce-dot 1.3s ease-in-out ${i * 0.18}s infinite`,
          boxShadow: i === 0 ? "0 0 6px #a78bfa" : i === 1 ? "0 0 6px #f472b6" : "0 0 6px #67e8f9",
        }} />
      ))}
    </span>
  );
}
