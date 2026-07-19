-- ============================================================
-- "Introduced" — Matchmaking App Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Extends Supabase auth.users with dating-relevant public profile info
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  age int,
  gender text,                    -- e.g. 'man', 'woman', 'nonbinary'
  seeking_gender text[],          -- who they're open to matching with
  location_city text,
  location_lat float8,
  location_lng float8,
  max_distance_miles int default 50,
  avatar_url text,                -- primary profile photo, set via the intake photo upload step
  photos jsonb default '[]'::jsonb,
  bio text,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Raw conversation log from the AI-assisted intake chat
create table if not exists intake_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  messages jsonb default '[]'::jsonb,   -- [{role, content, timestamp}]
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Structured profile extracted by Claude from the conversation.
-- This is what the matching algorithm actually scores against.
create table if not exists intake_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade unique,
  conversation_id uuid references intake_conversations(id),

  -- Core relationship intent
  relationship_goal text,           -- 'long-term', 'marriage-minded', 'casual', 'not sure yet'
  timeline text,                    -- how soon they want to be settled/serious

  -- Structured trait buckets — kept as JSONB so the schema flexes
  -- as you refine the question set without a migration each time.
  values jsonb default '{}'::jsonb,             -- e.g. {religion, politics_importance, family_importance}
  lifestyle jsonb default '{}'::jsonb,          -- e.g. {kids_wanted, kids_has, smoking, drinking, activity_level}
  personality jsonb default '{}'::jsonb,        -- e.g. {introvert_extrovert, love_language, conflict_style}
  interests text[] default '{}',
  dealbreakers jsonb default '{}'::jsonb,       -- hard filters, e.g. {must_want_kids: true, no_smokers: true}

  raw_summary text,                 -- human-readable summary for your admin review
  confidence numeric default 0,     -- how complete/confident the extraction was (0-1)

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Computed compatibility scores between user pairs (before you review)
create table if not exists match_scores (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid references profiles(id) on delete cascade,
  user_b_id uuid references profiles(id) on delete cascade,
  score numeric not null,                -- 0-100 overall compatibility
  score_breakdown jsonb default '{}'::jsonb,  -- per-category subscores + rationale
  created_at timestamptz default now(),
  unique (user_a_id, user_b_id)
);

-- The matches you've actually reviewed and acted on
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_score_id uuid references match_scores(id),
  user_a_id uuid references profiles(id) on delete cascade,
  user_b_id uuid references profiles(id) on delete cascade,
  status text default 'suggested',
    -- 'suggested' -> 'approved' | 'rejected' -> 'introduced' -> 'outcome_positive' | 'outcome_negative' | 'no_response'
  admin_notes text,
  introduced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_match_scores_score on match_scores (score desc);
create index if not exists idx_matches_status on matches (status);

-- These two are written to and read from only by the backend (via the service-role
-- key, which bypasses RLS entirely) — the admin dashboard goes through
-- app/api/admin/matches rather than querying these tables directly from the browser.
-- Enabling RLS with no policies means anon/authenticated clients get nothing.
alter table match_scores enable row level security;
alter table matches enable row level security;

-- Row Level Security — users can only see/edit their own profile + intake data.
-- Admin review dashboard should use the Supabase service role key server-side
-- to bypass RLS, never expose it client-side.
alter table profiles enable row level security;
alter table intake_conversations enable row level security;
alter table intake_profiles enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

create policy "Users manage own conversation" on intake_conversations
  for all using (auth.uid() = user_id);

create policy "Users read own intake profile" on intake_profiles
  for select using (auth.uid() = user_id);

-- ============================================================
-- Storage — profile photos
-- Creates a public bucket for profile photos and restricts writes so
-- users can only upload/replace/delete files inside their own folder
-- (path convention: {user_id}/{filename}).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view profile photos" on storage.objects
  for select using (bucket_id = 'profile-photos');

create policy "Users upload to their own folder" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update their own photos" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete their own photos" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
