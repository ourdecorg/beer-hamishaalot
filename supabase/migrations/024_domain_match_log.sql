-- Migration 024: add domain_match to match_attempts_log
--
-- domain_match: 1.0 if both wishes share the same primary_domain, 0.0 otherwise.
-- Replaces keywords_jaccard as the 4th scoring signal (×0.15).

alter table public.match_attempts_log
  add column if not exists domain_match double precision;
