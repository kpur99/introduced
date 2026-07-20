-- ============================================================
-- "Introduced" — Matchmaking App Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Extends Supabase auth.users with dating-relevant public profile info
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  age int,
  gender text,
  seeking_gender text[],
  location_city text,
  location_lat float8,
  location_lng float8,
  max_distance_miles int default 50,
  avatar_url text,
  photos jsonb default '[]'::jsonb,
  bio text,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists intake_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  messages jsonb default '[]'::jsonb,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists intake_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade unique,
  conversation_id uuid references intake_conversations(id),
  relationship_goal text,
  timeline text,
  values jsonb default '{}'::jsonb,
  lifestyle jsonb default '{}'::jsonb,
  personality jsonb default '{}'::jsonb,
  interests text[] default '{}',
  dealbreakers jsonb default '{}'::jsonb,
  raw_summary text,
  confidence numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists match_scores (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid references profiles(id) on delete cascade,
  user_b_id uuid references profiles(id) on delete cascade,
  score numeric not null,
  score_breakdown jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_a_id, user_b_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_score_id uuid references match_scores(id),
  user_a_id uuid references profiles(id) on delete cascade,
  user_b_id uuid references profiles(id) on delete cascade,
  status text default 'suggested',
  admin_notes text,
  introduced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_match_scores_score on match_scores (score desc);
create index if not exists idx_matches_status on matches (status);

alter table match_scores enable row level security;
alter table matches enable row level security;
alter table profiles enable row level security;
alter table intake_conversations enable row level security;
alter table intake_profiles enable row level security;

drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

drop policy if exists "Users manage own conversation" on intake_conversations;
create policy "Users manage own conversation" on intake_conversations
  for all using (auth.uid() = user_id);

drop policy if exists "Users read own intake profile" on intake_profiles;
create policy "Users read own intake profile" on intake_profiles
  for select using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view profile photos" on storage.objects;
create policy "Anyone can view profile photos" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "Users upload to their own folder" on storage.objects;
create policy "Users upload to their own folder" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own photos" on storage.objects;
create policy "Users update their own photos" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own photos" on storage.objects;
create policy "Users delete their own photos" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
