-- Migration 035: add original-language semantic similarity to match_attempts_log
--
-- The dual-embedding scheme (migration 034) produces two similarity scores per pair:
--   semantic_similarity      — English embedding (primary, used for ANN recall)
--   semantic_similarity_orig — original-language embedding (secondary signal)
-- Both contribute to the final match_score (35% + 20% respectively).

alter table public.match_attempts_log
  add column if not exists semantic_similarity_orig double precision;
