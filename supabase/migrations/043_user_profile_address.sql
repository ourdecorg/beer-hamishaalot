-- 043_user_profile_address.sql
-- Adds address field to user_profiles.
-- Identity/contact details live here, not on wish records.

alter table public.user_profiles
  add column if not exists address text;
