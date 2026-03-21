-- Migration 025: anchor_entities in wish_enrichment + anchor_overlap in match_attempts_log
--
-- anchor_entities: max-3 concrete nouns explicitly mentioned in the wish, in original language.
-- anchor_overlap:  deterministic 0/0.5/1 overlap score between two wishes' anchor_entities.

alter table public.wish_enrichment
  add column if not exists anchor_entities text[] not null default '{}';

alter table public.match_attempts_log
  add column if not exists anchor_overlap double precision;
