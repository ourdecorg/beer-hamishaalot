-- 044_countries.sql
-- Country reference table + country field on user_profiles.
--
-- countries: loaded by admin via /api/admin/seed-countries (UTF-8 CSV).
-- Format: id,alpha2,alpha3,name  (ISO 3166-1 standard)
-- Public read — no auth required (reference data).
--
-- user_profiles.country: stores the country name (English) chosen by the user.
-- Defaults to 'Israel' in the wish form UI.

create table if not exists public.countries (
  id     integer primary key,
  alpha2 text    not null,
  alpha3 text    not null,
  name   text    not null
);

alter table public.countries enable row level security;

create policy "countries_public_read" on public.countries
  for select using (true);

create index if not exists idx_countries_name on public.countries (name);

-- Add country to user_profiles
alter table public.user_profiles
  add column if not exists country text;
