"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// This page should be behind your own admin auth check (e.g. a specific
// user_id or email allowlist) — not shown here, add before shipping.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MatchRow = {
  id: string;
  status: string;
  admin_notes: string | null;
  match_scores: { score: number; score_breakdown: Record<string, { score: number; note: string }> };
  user_a: { first_name: string; age: number; bio: string };
  user_b: { first_name: string; age: number; bio: string };
};

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  async function loadMatches() {
    setLoading(true);
    const { data } = await supabase
      .from("matches")
      .select(
        `id, status, admin_notes,
         match_scores ( score, score_breakdown ),
         user_a:profiles!matches_user_a_id_fkey ( first_name, age, bio ),
         user_b:profiles!matches_user_b_id_fkey ( first_name, age, bio )`
      )
      .eq("status", "suggested")
      .order("id", { ascending: false });

    setMatches((data as unknown as MatchRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function updateStatus(matchId: string, status: string) {
    await supabase.from("matches").update({ status, updated_at: new Date().toISOString() }).eq("id", matchId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  }

  async function recompute() {
    setRecomputing(true);
    await fetch("/api/match/compute", { method: "POST" });
    await loadMatches();
    setRecomputing(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Suggested Matches</h1>
        <button
          onClick={recompute}
          disabled={recomputing}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: recomputing ? "#eee" : "#fff",
            cursor: recomputing ? "default" : "pointer",
          }}
        >
          {recomputing ? "Recomputing…" : "Recompute matches"}
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && matches.length === 0 && <p>No pending matches to review right now.</p>}

      {matches.map((m) => (
        <div
          key={m.id}
          style={{
            border: "1px solid #e2e2e2",
            borderRadius: 12,
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong>
              {m.user_a?.first_name} ({m.user_a?.age}) + {m.user_b?.first_name} ({m.user_b?.age})
            </strong>
            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{m.match_scores?.score}/100</span>
          </div>

          <div style={{ fontSize: "0.85rem", color: "#555", marginTop: 8 }}>
            {Object.entries(m.match_scores?.score_breakdown ?? {}).map(([key, val]) => (
              <div key={key}>
                {key}: {Math.round(val.score)} — {val.note}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              onClick={() => updateStatus(m.id, "approved")}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 8, background: "#2f6f4e", color: "#fff", border: "none" }}
            >
              Approve
            </button>
            <button
              onClick={() => updateStatus(m.id, "rejected")}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 8, background: "#eee", border: "1px solid #ccc" }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
