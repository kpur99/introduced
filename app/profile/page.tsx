"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ProfileRow = {
  first_name: string;
  age: number | null;
  location_city: string | null;
  avatar_url: string | null;
};

type IntakeProfileRow = {
  relationship_goal: string | null;
  timeline: string | null;
  raw_summary: string | null;
  interests: string[] | null;
  values: Record<string, string> | null;
  lifestyle: Record<string, string> | null;
  personality: Record<string, string> | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [intake, setIntake] = useState<IntakeProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      const [{ data: p }, { data: i }] = await Promise.all([
        supabase.from("profiles").select("first_name, age, location_city, avatar_url").eq("id", userId).single(),
        supabase
          .from("intake_profiles")
          .select("relationship_goal, timeline, raw_summary, interests, values, lifestyle, personality")
          .eq("user_id", userId)
          .single(),
      ]);

      setProfile(p as ProfileRow);
      setIntake(i as IntakeProfileRow);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--cream)", display: "grid", placeItems: "center" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--cream)", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>Sign in to view your profile.</p>
          <Link href="/intake" className="button on-cream">
            Go to intake
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)", padding: "70px 30px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link href="/" className="serif-italic small-label" style={{ display: "inline-block", marginBottom: 40, fontSize: "1.1rem" }}>
          introduced
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : "rgba(67,76,77,0.1)",
              flexShrink: 0,
            }}
          />
          <div>
            <h1 className="serif-italic" style={{ fontSize: "2.4rem", lineHeight: 1 }}>
              {profile?.first_name || "Your profile"}
            </h1>
            <p style={{ color: "rgba(67,76,77,0.65)" }}>
              {[profile?.age, profile?.location_city].filter(Boolean).join(" · ") || "No details yet"}
            </p>
          </div>
        </div>

        {!intake ? (
          <div>
            <p style={{ marginBottom: 20, color: "rgba(67,76,77,0.7)" }}>
              You haven't completed your intake conversation yet.
            </p>
            <Link href="/intake" className="button on-cream">
              Start now
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {intake.raw_summary && (
              <div>
                <span className="small-label" style={{ color: "rgba(67,76,77,0.5)" }}>Summary</span>
                <p style={{ marginTop: 8, lineHeight: 1.7 }}>{intake.raw_summary}</p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <span className="small-label" style={{ color: "rgba(67,76,77,0.5)" }}>Looking for</span>
                <p style={{ marginTop: 6 }}>{intake.relationship_goal || "—"}</p>
              </div>
              <div>
                <span className="small-label" style={{ color: "rgba(67,76,77,0.5)" }}>Timeline</span>
                <p style={{ marginTop: 6 }}>{intake.timeline || "—"}</p>
              </div>
            </div>

            {intake.interests && intake.interests.length > 0 && (
              <div>
                <span className="small-label" style={{ color: "rgba(67,76,77,0.5)" }}>Interests</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {intake.interests.map((int) => (
                    <span
                      key={int}
                      style={{
                        border: "1.5px solid rgba(67,76,77,0.25)",
                        borderRadius: 999,
                        padding: "5px 14px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {[
              { label: "Values", data: intake.values },
              { label: "Lifestyle", data: intake.lifestyle },
              { label: "Personality", data: intake.personality },
            ]
              .filter((g) => g.data)
              .map((g) => (
                <div key={g.label}>
                  <span className="small-label" style={{ color: "rgba(67,76,77,0.5)" }}>{g.label}</span>
                  <div style={{ marginTop: 8 }}>
                    {Object.entries(g.data as Record<string, string>).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderTop: "1px solid rgba(67,76,77,0.12)",
                        }}
                      >
                        <span style={{ textTransform: "capitalize", color: "rgba(67,76,77,0.7)" }}>{k.replace(/_/g, " ")}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            <Link href="/intake" className="button on-cream" style={{ alignSelf: "flex-start", marginTop: 12 }}>
              Update my answers
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
