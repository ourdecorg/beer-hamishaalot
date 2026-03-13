-- Migration 005: Add user_email column to wishes table.
-- Stores the authenticated user's email at wish creation time so it can be
-- displayed on the public feed without joining with auth.users.

alter table public.wishes
  add column if not exists user_email text;
