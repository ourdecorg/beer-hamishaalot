-- ============================================================
-- Migration 033: relevance gate logging + match_reviews table
-- ============================================================

-- 1. Extend match_attempts_log with gate fields
alter table public.match_attempts_log
  add column if not exists gate_passed boolean,
  add column if not exists gate_reason text;

-- 2. Manual review / human-labeling table
create table if not exists public.match_reviews (
  id               uuid        primary key default gen_random_uuid(),
  connection_id    uuid        null references public.wish_connections(id) on delete cascade,
  wish_id          uuid        not null references public.wishes(id) on delete cascade,
  candidate_wish_id uuid       not null references public.wishes(id) on delete cascade,
  reviewer_email   text        not null,
  label            text        not null check (label in ('good', 'maybe', 'bad')),
  note             text        null,
  created_at       timestamptz not null default now(),
  unique (wish_id, candidate_wish_id, reviewer_email)
);

create index if not exists match_reviews_wish_id_idx
  on public.match_reviews (wish_id);

create index if not exists match_reviews_connection_id_idx
  on public.match_reviews (connection_id)
  where connection_id is not null;

-- RLS: admin-only (reads/writes via service role client)
alter table public.match_reviews enable row level security;
