import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { scoreCompatibility, IntakeProfile } from "@/lib/matching";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Call this on a schedule (e.g. nightly via a Vercel cron job) or manually
// from the admin dashboard to (re)compute scores for all completed profiles.
export async function POST() {
  const { data: profiles, error } = await supabaseAdmin
    .from("intake_profiles")
    .select("*, profiles!inner(id, gender, seeking_gender, age, onboarding_complete)")
    .eq("profiles.onboarding_complete", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles || profiles.length < 2) {
    return NextResponse.json({ message: "Not enough completed profiles yet", computed: 0 });
  }

  let computed = 0;

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];

      // Basic gender-preference filter before scoring at all.
      const aWantsB = a.profiles.seeking_gender?.includes(b.profiles.gender);
      const bWantsA = b.profiles.seeking_gender?.includes(a.profiles.gender);
      if (!aWantsB || !bWantsA) continue;

      const result = scoreCompatibility(a as unknown as IntakeProfile, b as unknown as IntakeProfile);
      if (result.hardFiltered) continue;

      await supabaseAdmin.from("match_scores").upsert(
        {
          user_a_id: a.user_id,
          user_b_id: b.user_id,
          score: result.score,
          score_breakdown: result.breakdown,
        },
        { onConflict: "user_a_id,user_b_id" }
      );

      // Auto-create a "suggested" match entry for anything above a reasonable bar,
      // so it shows up in your admin queue without you having to sift through everything.
      if (result.score >= 65) {
        const { data: scoreRow } = await supabaseAdmin
          .from("match_scores")
          .select("id")
          .eq("user_a_id", a.user_id)
          .eq("user_b_id", b.user_id)
          .single();

        await supabaseAdmin.from("matches").upsert(
          {
            match_score_id: scoreRow?.id,
            user_a_id: a.user_id,
            user_b_id: b.user_id,
            status: "suggested",
          },
          { onConflict: "user_a_id,user_b_id", ignoreDuplicates: true }
        );
      }

      computed++;
    }
  }

  return NextResponse.json({ message: "Scoring complete", computed });
}
