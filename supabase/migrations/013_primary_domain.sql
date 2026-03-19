-- Migration 013: primary_domain field on wish_enrichment
--
-- Adds a single controlled-vocabulary label for the top-level domain of each wish.
-- Used by the v4 matching formula to prevent cross-domain false positives.
--
-- Vocabulary (15 values):
--   health_wellness | technology | entrepreneurship | education | arts_culture |
--   community_social | environment | spirituality | family_parenting |
--   sports_recreation | food_lifestyle | finance | personal_development |
--   professional_career | other
--
-- Existing rows default to NULL → matching code treats NULL as neutral (0.5).
-- Re-run analyzeAndStoreWish on existing wishes to populate this field.

ALTER TABLE wish_enrichment
  ADD COLUMN IF NOT EXISTS primary_domain text;

COMMENT ON COLUMN wish_enrichment.primary_domain IS
  'Top-level domain of the wish. Values: health_wellness|technology|entrepreneurship|education|arts_culture|community_social|environment|spirituality|family_parenting|sports_recreation|food_lifestyle|finance|personal_development|professional_career|other. NULL = analyzed before migration 013, treated as neutral in scoring.';

-- Add domain_match column to match_attempts_log for observability
ALTER TABLE match_attempts_log
  ADD COLUMN IF NOT EXISTS domain_match numeric(6,3);

COMMENT ON COLUMN match_attempts_log.domain_match IS
  'Domain alignment score (0–1) between the two wishes primary_domain values.';
