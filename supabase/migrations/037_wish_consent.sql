-- 037_wish_consent.sql
-- Add consent_to_match_sharing column to wishes table.
-- Records explicit user consent that their wish content may be shared
-- with relevant matches when resonance is identified.

ALTER TABLE wishes
  ADD COLUMN IF NOT EXISTS consent_to_match_sharing boolean NOT NULL DEFAULT false;
