-- ============================================================
-- באר המשאלות — Migration 002
-- Add contact info columns for open wishes
-- ============================================================

alter table public.wishes
  add column if not exists contact_name    text,
  add column if not exists contact_email   text,
  add column if not exists contact_country text,
  add column if not exists contact_city    text,
  add column if not exists contact_address text,
  add column if not exists contact_phone   text;
