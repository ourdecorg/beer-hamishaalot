-- Migration 016: location and date range fields in wish_enrichment
--
-- location_lat / location_lng: approximate WGS-84 coordinates extracted by GPT
--   when the wish mentions a specific place (city, country, venue).
-- location_name: original place name as written in the wish.
-- date_range_start / date_range_end: ISO date bounds when the wish is time-scoped
--   (e.g. "this summer", "January 2026", "next three months").
--
-- All columns are nullable — most wishes have no location or time constraint.
-- Run in Supabase SQL Editor.

alter table public.wish_enrichment
  add column if not exists location_lat    double precision,
  add column if not exists location_lng    double precision,
  add column if not exists location_name   text,
  add column if not exists date_range_start date,
  add column if not exists date_range_end   date;
