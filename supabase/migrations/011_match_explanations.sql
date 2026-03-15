-- Migration 011: Add explainability fields to matching tables
--
-- wish_connections gains an `explanation` JSONB column storing the
-- machine-generated match rationale (short_reason, matched themes,
-- canonical concepts, intent_compatibility, freshness_factor).
--
-- match_attempts_log gains two new scoring dimension columns so every
-- scoring attempt is fully auditable.

alter table public.wish_connections
  add column if not exists explanation jsonb;

alter table public.match_attempts_log
  add column if not exists intent_compatibility float,
  add column if not exists freshness_factor float;
