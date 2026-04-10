-- 046_drop_unused_log_columns.sql
--
-- Drop columns from match_attempts_log that are no longer written or read.
--
-- theme_overlap       — always written as 0 since the v5 scoring rewrite; not displayed anywhere.
-- intent_compatibility— always written as 0 since v5; not displayed anywhere.
-- freshness_factor    — added in 011, never populated in any scoring run.
-- object_alignment    — added in 012, never populated in any scoring run.
-- keywords_jaccard    — added in 023, replaced by structural_similarity; never populated.
-- anchor_overlap      — added in 025, replaced by structural_similarity; never populated.
-- semantic_similarity_orig — added in 035 for dual-embedding experiment; never populated.
-- distance_km         — added in 017; geo_penalty (exp(-d/50)) is logged instead.
-- failed_distance     — added in 017; never set to true in current engine.
-- failed_date_range   — added in 018; never set to true in current engine.

alter table public.match_attempts_log
  drop column if exists theme_overlap,
  drop column if exists intent_compatibility,
  drop column if exists freshness_factor,
  drop column if exists object_alignment,
  drop column if exists keywords_jaccard,
  drop column if exists anchor_overlap,
  drop column if exists semantic_similarity_orig,
  drop column if exists distance_km,
  drop column if exists failed_distance,
  drop column if exists failed_date_range;
