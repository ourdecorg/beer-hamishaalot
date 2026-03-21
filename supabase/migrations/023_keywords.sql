-- Migration 023: add keywords to wish_enrichment and keywords_jaccard to match_attempts_log
--
-- keywords: verbatim or near-verbatim terms extracted from the wish text by the LLM,
--   in the original language of the wish. Used as a 4th scoring signal (Jaccard, ×0.15).
-- keywords_jaccard: Jaccard similarity between the two wishes' keywords arrays.

alter table public.wish_enrichment
  add column if not exists keywords text[] not null default '{}';

alter table public.match_attempts_log
  add column if not exists keywords_jaccard double precision;
