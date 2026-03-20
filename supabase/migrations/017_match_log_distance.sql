-- Migration 017: distance fields in match_attempts_log
--
-- distance_km: Haversine distance between the two wishes' locations.
--   Null when either wish has no location coordinates.
-- failed_distance: true when the attempt was rejected solely because
--   distance_km exceeded the MAX_DISTANCE_KM threshold (currently 30 km).
--
-- Run in Supabase SQL Editor.

alter table public.match_attempts_log
  add column if not exists distance_km     double precision,
  add column if not exists failed_distance boolean not null default false;
