import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Service-role client — bypasses RLS. This route is the only way the admin
// dashboard should touch `matches` / `match_scores` now that RLS is enabled
// on them with no anon/authenticated policies.
//
// TODO: this route has no auth check yet — anyone who finds the URL can call
// it. Add an admin allowlist check here before this goes live (see README).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      `id, status, admin_notes,
       match_scores ( score, score_breakdown ),
       user_a:profiles!matches_user_a_id_fkey ( first_name, age, bio ),
       user_b:profiles!matches_user_b_id_fkey ( first_name, age, bio )`
    )
    .eq("status", "suggested")
    .order("id", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data });
}

export async function PATCH(req: NextRequest) {
  const { matchId, status } = await req.json();

  if (!matchId || !status) {
    return NextResponse.json({ error: "matchId and status required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("matches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
