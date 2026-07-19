"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// NOTE: this page assumes the user is already signed in via Supabase Auth
// and that a row exists for them in `profiles` (see db/schema.sql). Auth
// isn't wired up yet in this starter — see README "Not built yet" for the
// fastest way to add it (Supabase magic link is a couple hours of work).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Message = { role: "user" | "assistant"; content: string };

export default function IntakePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm going to ask a few questions to get to know you. Think of this less like a form, more like a conversation. First: what are you hoping to find here?",
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending || !userId) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setSending(true);

    const res = await fetch("/api/intake/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, conversationId, message: userMessage }),
    });
    const data = await res.json();

    setConversationId(data.conversationId);
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    setComplete(data.complete);
    setSending(false);
  }

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "0.8fr 1.2fr",
        minHeight: "100vh",
        background: "var(--charcoal)",
        color: "var(--cream)",
      }}
      className="profile-section"
    >
      <div style={{ padding: "90px 70px", borderRight: "1px solid var(--line-light)" }}>
        <div style={{ position: "sticky", top: 70 }}>
          <span className="small-label" style={{ display: "block", marginBottom: 24 }}>
            Get started
          </span>
          <h2
            className="serif-italic"
            style={{ marginBottom: 25, fontSize: "clamp(3rem, 6vw, 6rem)", lineHeight: 0.95, letterSpacing: "-0.05em" }}
          >
            Tell us about yourself.
          </h2>
          <p style={{ maxWidth: 440, color: "rgba(255,243,217,0.74)", lineHeight: 1.7 }}>
            A few thoughtful answers can tell us much more than a swipe ever could. Your
            answers stay private and are only used to help make intentional introductions.
          </p>
        </div>
      </div>

      <div style={{ padding: "90px 70px" }}>
        {!userId && (
          <div
            style={{
              maxWidth: 720,
              padding: 24,
              background: "var(--cream)",
              color: "var(--charcoal)",
              borderRadius: 4,
              marginBottom: 24,
            }}
          >
            Sign in to start your profile conversation. (Auth isn't wired up in this starter yet —
            see the README for the fastest path with Supabase magic link.)
          </div>
        )}

        <div
          style={{
            maxWidth: 720,
            background: "var(--cream)",
            color: "var(--charcoal)",
            borderRadius: 4,
            padding: 42,
          }}
        >
          <div
            ref={scrollRef}
            style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "var(--charcoal)" : "rgba(67,76,77,0.08)",
                  color: m.role === "user" ? "var(--cream)" : "var(--charcoal)",
                  padding: "10px 16px",
                  borderRadius: 14,
                  maxWidth: "82%",
                  lineHeight: 1.55,
                }}
              >
                {m.content}
              </div>
            ))}
          </div>

          {complete ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <h3 className="serif-italic" style={{ fontSize: "2rem", marginBottom: 10 }}>
                You're ready to be introduced.
              </h3>
              <p style={{ color: "rgba(67,76,77,0.75)" }}>
                We'll reach out once we've found a match worth reviewing.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type your answer…"
                disabled={!userId || sending}
                style={{
                  flex: 1,
                  minHeight: 50,
                  border: 0,
                  borderBottom: "2px solid rgba(67,76,77,0.3)",
                  background: "transparent",
                  color: "var(--charcoal)",
                  outline: "none",
                }}
              />
              <button
                onClick={send}
                disabled={!userId || sending}
                className="button on-cream"
                style={{ minHeight: 50, padding: "0 24px" }}
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
