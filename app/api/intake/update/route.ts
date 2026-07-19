import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Called from the review screen after the intake conversation completes, so the
// person can correct anything Claude's extraction got wrong before it's used for matching.
export async function PATCH(req: NextRequest) {
  const { userId, relationship_goal, timeline, raw_summary, interests } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("intake_profiles")
    .update({
      relationship_goal,
      timeline,
      raw_summary,
      interests,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
