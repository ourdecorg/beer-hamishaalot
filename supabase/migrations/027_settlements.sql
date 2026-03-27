-- ============================================================
-- Migration 027: Settlements reference table (ישובים)
-- Data is seeded separately via scripts/seed-settlements.mjs
-- ============================================================

create table if not exists public.settlements (
  id       integer primary key,   -- סמל ישוב (CBS code)
  name     text    not null,       -- שם ישוב בעברית
  name_en  text,                   -- שם ישוב באנגלית / תעתיק
  district text,                   -- שם נפה
  council  text                    -- שם מועצה אזורית
);

alter table public.settlements enable row level security;

-- settlements are public reference data — anyone (including anon) can read
create policy "settlements_public_read"
  on public.settlements
  for select
  using (true);
