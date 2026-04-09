-- 045_drop_unused_columns.sql
--
-- Drop identity/contact columns that are no longer written or read.
--
-- wishes.contact_* — moved to user_profiles (migration 041).
--   New wishes have never written these fields since migration 041.
--   All application code that read them has been removed.
--
-- user_profiles.address  — added in 043, immediately superseded by country+city in 044.
-- user_profiles.linkedin_url / short_bio / organization / role
--   — removed from the disclosure UI and all server-side whitelists.

-- ── wishes ────────────────────────────────────────────────────────────────────
alter table public.wishes
  drop column if exists contact_name,
  drop column if exists contact_email,
  drop column if exists contact_country,
  drop column if exists contact_city,
  drop column if exists contact_address,
  drop column if exists contact_phone;

-- ── user_profiles ─────────────────────────────────────────────────────────────
alter table public.user_profiles
  drop column if exists address,
  drop column if exists linkedin_url,
  drop column if exists short_bio,
  drop column if exists organization,
  drop column if exists role;
