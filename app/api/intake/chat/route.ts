import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service-role client — server-only, bypasses RLS. Never expose this key client-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INTERVIEWER_SYSTEM_PROMPT = `You are a warm, perceptive matchmaker conducting an intake interview
for a dating service. Your job is to have a natural conversation — not a survey — that surfaces:

1. What they're looking for (relationship_goal, timeline)
2. Core values (religion/spirituality, politics importance, family closeness, ambition)
3. Lifestyle (kids wanted/has, smoking, drinking, activity level, routine vs spontaneous)
4. Personality (introvert/extrovert, love language, conflict style, communication style)
5. Interests (what they actually spend time on)
6. Dealbreakers (things that are non-negotiable for them)

Rules:
- Ask ONE question at a time. Keep it conversational and specific, not clinical.
- Follow up naturally on interesting answers rather than marching through a checklist.
- After roughly 12-18 exchanges, or once you have enough signal on all six areas above,
  say something warm that signals the interview is wrapping up, and include the exact
  marker "[INTAKE_COMPLETE]" at the very end of your message (on its own, after your closing text).
- Never be repetitive. Never ask two questions in one message.`;

const EXTRACTION_SYSTEM_PROMPT = `You are extracting a structured profile from a matchmaking intake
conversation transcript. Read the full transcript and output ONLY valid JSON (no markdown fences,
no preamble) matching this shape:

{
  "relationship_goal": string,
  "timeline": string,
  "values": { "religion": string, "politics_importance": string, "family_importance": string, "ambition_level": string },
  "lifestyle": { "kids_wanted": string, "kids_has": string, "smoking": string, "drinking": string, "activity_level": string, "routine_vs_spontaneous": string },
  "personality": { "introvert_extrovert": string, "love_language": string, "conflict_style": string, "communication_style": string },
  "interests": string[],
  "dealbreakers": { [key: string]: boolean | string },
  "raw_summary": string,   // 3-5 sentence human-readable summary for a matchmaker reviewing this profile
  "confidence": number     // 0-1, how complete/certain this extraction is given the transcript
}

If something wasn't discussed, use your best inference from context, or "unknown" for strings /
empty for arrays — never fabricate specifics that weren't implied.`;

export async function POST(req: NextRequest) {
  const { userId, conversationId, message } = await req.json();

  if (!userId || !message) {
    return NextResponse.json({ error: "userId and message required" }, { status: 400 });
  }

  // Load or create the conversation
  let conversation;
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from("intake_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    conversation = data;
  }
  if (!conversation) {
    const { data } = await supabaseAdmin
      .from("intake_conversations")
      .insert({ user_id: userId, messages: [] })
      .select()
      .single();
    conversation = data;
  }

  const history = (conversation.messages ?? []) as { role: "user" | "assistant"; content: string }[];
  const updatedHistory = [...history, { role: "user" as const, content: message }];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: INTERVIEWER_SYSTEM_PROMPT,
    messages: updatedHistory.map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const isComplete = assistantText.includes("[INTAKE_COMPLETE]");
  const cleanedText = assistantText.replace("[INTAKE_COMPLETE]", "").trim();

  const finalHistory = [...updatedHistory, { role: "assistant" as const, content: cleanedText }];

  await supabaseAdmin
    .from("intake_conversations")
    .update({ messages: finalHistory, completed: isComplete, updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // Once the interview wraps up, run the extraction pass and save the structured profile
  if (isComplete) {
    const transcript = finalHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const extraction = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    });

    const extractionText = extraction.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      const parsed = JSON.parse(extractionText);
      await supabaseAdmin.from("intake_profiles").upsert(
        {
          user_id: userId,
          conversation_id: conversation.id,
          relationship_goal: parsed.relationship_goal,
          timeline: parsed.timeline,
          values: parsed.values,
          lifestyle: parsed.lifestyle,
          personality: parsed.personality,
          interests: parsed.interests,
          dealbreakers: parsed.dealbreakers,
          raw_summary: parsed.raw_summary,
          confidence: parsed.confidence,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch (e) {
      console.error("Failed to parse extraction JSON", e, extractionText);
    }
  }

  return NextResponse.json({
    conversationId: conversation.id,
    reply: cleanedText,
    complete: isComplete,
  });
}
