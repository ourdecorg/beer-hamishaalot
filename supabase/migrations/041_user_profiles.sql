-- 041_user_profiles.sql
-- Dedicated user profile table for identity/contact fields.
--
-- Design rationale:
--   Wishes are content-centric and should NOT store personal identity.
--   This table is the single source of truth for a user's reusable contact
--   and identity information. Fields are NEVER automatically shared — they
--   are disclosed only when a user explicitly accepts a connection and
--   chooses which fields to include (see migration 042).
--
-- All fields are nullable: a user can create a profile incrementally.
-- RLS: only the owner can read or write their own profile row.
-- The service-role (admin) client can read profiles server-side during
-- the disclosure snapshot capture in the respond endpoint.

create table if not exists public.user_profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,
  display_name     text,
  email            text,
  phone            text,
  linkedin_url     text,
  short_bio        text,
  city             text,
  organization     text,
  role             text,
  updated_at       timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Owner can read their own profile
create policy "profile_owner_select" on public.user_profiles
  for select using (auth.uid() = id);

-- Owner can insert (upsert pattern — only once, for their own id)
create policy "profile_owner_insert" on public.user_profiles
  for insert with check (auth.uid() = id);

-- Owner can update their own profile
create policy "profile_owner_update" on public.user_profiles
  for update using (auth.uid() = id);
