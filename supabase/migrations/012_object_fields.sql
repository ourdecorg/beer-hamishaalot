-- Migration 012: Object-aware matching fields
--
-- Adds 6 new columns to wish_enrichment for object-level analysis:
--   subject_type, subject_entities, target_action, object_of_need,
--   constraints, domain_entities
--
-- Also adds object_alignment to match_attempts_log for full score auditability.
-- All columns are additive — old rows default to null/'{}' and degrade gracefully.

alter table public.wish_enrichment
  add column if not exists subject_type     text,
  add column if not exists subject_entities text[] not null default '{}',
  add column if not exists target_action    text,
  add column if not exists object_of_need   text[] not null default '{}',
  add column if not exists constraints      text[] not null default '{}',
  add column if not exists domain_entities  text[] not null default '{}';

alter table public.match_attempts_log
  add column if not exists object_alignment float;
