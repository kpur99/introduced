# Introduced — Matchmaking App Starter

Working name: **Introduced**. Swap it later if the domain's taken — nothing here is name-locked.

## Design system (finalized)
Cream `#fff3d9` + charcoal `#434c4d`. Georgia italic serif for display type (the huge
"Introduced" wordmark, section headings), Arial/Helvetica for body copy, uppercase
letter-spaced micro-labels ("01 — PROFILE"), full-pill buttons. Tokens live in
`app/globals.css` — reuse `.serif-italic`, `.small-label`, and `.button` / `.button.on-cream`
everywhere rather than restyling per-page. The old exploratory directions (soft/feminine,
heritage/kraft, Mañana-style, etc.) are still in `/design` for reference but this is the
one being built out.

## Stack (matches your other apps)
Next.js (App Router) + Supabase + Anthropic API + Vercel.

## How it works
1. **Landing page** (`app/page.tsx`) — hero, three-step "how it works" strip, footer.
   Converted directly from the reference HTML you liked, same look, now a real Next.js page.
2. **AI-assisted intake** (`app/intake/page.tsx`, `app/api/intake/chat`) — split-screen
   layout (sticky charcoal heading on the left, cream chat card on the right) wired to a
   real conversation with Claude instead of a static form. User has a natural back-and-forth;
   once Claude has enough signal, it wraps up and a second Claude call extracts a structured
   JSON profile into the `intake_profiles` table.
3. **Matching algorithm** (`lib/matching.ts`) — dealbreakers are hard filters (instant
   exclusion). Everything else (relationship goals, values, lifestyle, personality,
   interests) is weighted and scored 0-100. Weights live at the top of the file.
4. **Score computation** (`app/api/match/compute`) — scores all eligible pairs and
   auto-creates a "suggested" match for anything scoring 65+.
5. **Admin review** (`app/admin/matches`) — approval queue with score breakdown per pair.
   Still on the old unstyled markup — say the word and I'll bring it in line with the
   cream/charcoal system too.

## ⚠️ Auth is the missing piece
The intake page checks `supabase.auth.getUser()` and won't let anyone type until a user is
signed in — but there's no sign-up/sign-in flow yet, so right now nobody can actually get a
`userId`. Fastest path: Supabase Auth with magic link (email-only, no password UI to build).
This is the next thing to build before this is usable end-to-end.

## Setup steps
1. Create a new Supabase project, run `db/schema.sql` in the SQL editor.
2. Copy this whole folder into a fresh Next.js project (or use it as the project directly —
   `package.json` and `tsconfig.json` are included).
3. Env vars needed:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose client-side)
4. `npm install`
5. Lock down `/admin/matches` behind real auth before this goes live — right now it's
   wide open to anyone with the URL.

## Not built yet (next steps)
- Supabase Auth (magic link) — see the warning above, this blocks everything else
- Profile photo upload (Supabase Storage)
- "You've been introduced" notification + reveal flow once a match is approved
- Admin allowlist for the `/admin` routes, and restyling admin to match the new system
- Basic safety/reporting flow (report user, block user) — important for any dating product

