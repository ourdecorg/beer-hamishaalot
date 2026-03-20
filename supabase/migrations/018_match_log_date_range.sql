-- Migration 018: date-range overlap field in match_attempts_log
--
-- failed_date_range: true when the attempt was rejected because the two
--   wishes' effective date ranges do not overlap.
--   (no overlap = the time windows are mutually exclusive)
--
-- Run in Supabase SQL Editor.

alter table public.match_attempts_log
  add column if not exists failed_date_range boolean not null default false;
