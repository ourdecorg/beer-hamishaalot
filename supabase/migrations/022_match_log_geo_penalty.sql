-- Migration 022: add geo_penalty to match_attempts_log
--
-- geo_penalty: soft distance multiplier applied to the raw match_score.
--   exp(-distance_km / 50). 1.0 when either wish has no location.
--   final_score = match_score × geo_penalty (before threshold check).

alter table public.match_attempts_log
  add column if not exists geo_penalty double precision;
