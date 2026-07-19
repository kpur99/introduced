"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// NOTE: this page assumes the user is already signed in via Supabase Auth
// and that a row exists for them in `profiles` (see db/schema.sql). Auth
// isn't wired up yet in this starter — see README "Not built yet" for the
// fastest way to add it (Supabase magic link is a couple hours of work).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Message = { role: "user" | "assistant"; content: string; options?: string[] | null };
type Stage = "chat" | "review" | "photo" | "done";

type IntakeProfileRow = {
  relationship_goal: string | null;
  timeline: string | null;
  raw_summary: string | null;
  interests: string[] | null;
  values: Record<string, string> | null;
  lifestyle: Record<string, string> | null;
  personality: Record<string, string> | null;
};

export default function IntakePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("chat");

  // --- chat state ---
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm going to ask a few questions to get to know you. Think of this less like a form, more like a conversation. First: what are you hoping to find here?",
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- review state ---
  const [profile, setProfile] = useState<IntakeProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- photo state ---
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending || !userId) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    const res = await fetch("/api/intake/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, conversationId, message: text }),
    });
    const data = await res.json();

    setConversationId(data.conversationId);
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply, options: data.options }]);
    if (typeof data.progress === "number") setProgress(data.progress);
    setSending(false);

    if (data.complete) {
      setLoadingProfile(true);
      const { data: row } = await supabase
        .from("intake_profiles")
        .select("relationship_goal, timeline, raw_summary, interests, values, lifestyle, personality")
        .eq("user_id", userId)
        .single();
      setProfile(row as IntakeProfileRow);
      setLoadingProfile(false);
      setStage("review");
    }
  }

  async function saveReview() {
    if (!profile || !userId) return;
    setSaving(true);
    await fetch("/api/intake/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        relationship_goal: profile.relationship_goal,
        timeline: profile.timeline,
        raw_summary: profile.raw_summary,
        interests: profile.interests,
      }),
    });
    setSaving(false);
    setStage("photo");
  }

  function onPhotoChosen(file: File | null) {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!photoFile || !userId) return;
    setUploading(true);

    const ext = photoFile.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, photoFile, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("profile-photos").getPublicUrl(path);

    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl.publicUrl, onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setUploading(false);
    setStage("done");
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
          <p style={{ maxWidth: 440, color: "rgba(255,243,217,0.74)", lineHeight: 1.7, marginBottom: 32 }}>
            A few thoughtful answers can tell us much more than a swipe ever could. Your
            answers stay private and are only used to help make intentional introductions.
          </p>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,243,217,0.6)",
                marginBottom: 8,
              }}
            >
              <span>Profile progress</span>
              <span>{stage === "chat" ? progress : 100}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,243,217,0.15)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${stage === "chat" ? progress : 100}%`,
                  background: "var(--cream)",
                  borderRadius: 999,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
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
          {/* ---------- CHAT STAGE ---------- */}
          {stage === "chat" && (
            <>
              <div
                ref={scrollRef}
                style={{ maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}
              >
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <span className="small-label" style={{ fontSize: "0.66rem", color: "rgba(67,76,77,0.5)", marginBottom: 4, letterSpacing: "0.1em" }}>
                      {m.role === "user" ? "You" : "Introduced"}
                    </span>
                    <div
                      style={{
                        background: m.role === "user" ? "var(--charcoal)" : "rgba(67,76,77,0.08)",
                        color: m.role === "user" ? "var(--cream)" : "var(--charcoal)",
                        padding: "12px 18px",
                        borderRadius: 16,
                        maxWidth: "82%",
                        lineHeight: 1.6,
                      }}
                    >
                      {m.content}
                    </div>

                    {m.role === "assistant" && m.options && i === messages.length - 1 && !sending && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {m.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => sendMessage(opt)}
                            style={{
                              border: "1.5px solid rgba(67,76,77,0.35)",
                              background: "transparent",
                              color: "var(--charcoal)",
                              borderRadius: 999,
                              padding: "8px 16px",
                              fontSize: "0.88rem",
                              cursor: "pointer",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span className="small-label" style={{ fontSize: "0.66rem", color: "rgba(67,76,77,0.5)", marginBottom: 4, letterSpacing: "0.1em" }}>
                      Introduced
                    </span>
                    <div style={{ background: "rgba(67,76,77,0.08)", padding: "12px 18px", borderRadius: 16, display: "flex", gap: 5 }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "rgba(67,76,77,0.5)",
                            animation: `typingDot 1.2s ${i * 0.15}s infinite ease-in-out`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
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
                <button onClick={() => sendMessage(input)} disabled={!userId || sending} className="button on-cream" style={{ minHeight: 50, padding: "0 24px" }}>
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}

          {/* ---------- REVIEW STAGE ---------- */}
          {stage === "review" && (
            <div>
              <span className="small-label" style={{ color: "rgba(67,76,77,0.55)" }}>Almost there</span>
              <h3 className="serif-italic" style={{ fontSize: "2rem", margin: "8px 0 6px" }}>
                Here's what we heard.
              </h3>
              <p style={{ color: "rgba(67,76,77,0.7)", marginBottom: 28 }}>
                Take a look and fix anything that's off before we start finding matches.
              </p>

              {loadingProfile || !profile ? (
                <p>Loading your profile…</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Relationship goal
                    </label>
                    <input
                      value={profile.relationship_goal ?? ""}
                      onChange={(e) => setProfile({ ...profile, relationship_goal: e.target.value })}
                      style={{ width: "100%", minHeight: 46, border: 0, borderBottom: "2px solid rgba(67,76,77,0.3)", background: "transparent", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Timeline
                    </label>
                    <input
                      value={profile.timeline ?? ""}
                      onChange={(e) => setProfile({ ...profile, timeline: e.target.value })}
                      style={{ width: "100%", minHeight: 46, border: 0, borderBottom: "2px solid rgba(67,76,77,0.3)", background: "transparent", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Summary
                    </label>
                    <textarea
                      value={profile.raw_summary ?? ""}
                      onChange={(e) => setProfile({ ...profile, raw_summary: e.target.value })}
                      style={{ width: "100%", minHeight: 110, padding: "10px 0", border: 0, borderBottom: "2px solid rgba(67,76,77,0.3)", background: "transparent", outline: "none", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Interests
                    </label>
                    <input
                      value={(profile.interests ?? []).join(", ")}
                      onChange={(e) => setProfile({ ...profile, interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="comma separated"
                      style={{ width: "100%", minHeight: 46, border: 0, borderBottom: "2px solid rgba(67,76,77,0.3)", background: "transparent", outline: "none" }}
                    />
                  </div>

                  {[profile.values, profile.lifestyle, profile.personality].filter(Boolean).map((group, gi) => (
                    <div key={gi} style={{ fontSize: "0.88rem", color: "rgba(67,76,77,0.7)" }}>
                      {Object.entries(group as Record<string, string>).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid rgba(67,76,77,0.1)" }}>
                          <span style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  <button className="button on-cream" onClick={saveReview} disabled={saving} style={{ marginTop: 8 }}>
                    {saving ? "Saving…" : "Looks good — continue"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------- PHOTO STAGE ---------- */}
          {stage === "photo" && (
            <div style={{ textAlign: "center", paddingTop: 10 }}>
              <h3 className="serif-italic" style={{ fontSize: "1.9rem", marginBottom: 8 }}>
                One last thing — add a photo.
              </h3>
              <p style={{ color: "rgba(67,76,77,0.75)", marginBottom: 24 }}>
                This is what we'll show a match once you're both introduced.
              </p>

              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                  background: photoPreview ? `url(${photoPreview}) center/cover` : "rgba(67,76,77,0.08)",
                  border: "2px solid rgba(67,76,77,0.2)",
                }}
              />

              <label className="button on-cream" style={{ cursor: "pointer", display: "inline-flex", marginRight: 12 }}>
                {photoFile ? "Choose a different photo" : "Choose a photo"}
                <input type="file" accept="image/*" onChange={(e) => onPhotoChosen(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              </label>

              {photoFile && (
                <button className="button" onClick={uploadPhoto} disabled={uploading}>
                  {uploading ? "Uploading…" : "Save & finish"}
                </button>
              )}
            </div>
          )}

          {/* ---------- DONE STAGE ---------- */}
          {stage === "done" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <h3 className="serif-italic" style={{ fontSize: "2rem", marginBottom: 10 }}>
                You're ready to be introduced.
              </h3>
              <p style={{ color: "rgba(67,76,77,0.75)", marginBottom: 20 }}>
                We'll reach out once we've found a match worth reviewing.
              </p>
              <Link href="/profile" className="button on-cream">
                View my profile
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </section>
  );
}
