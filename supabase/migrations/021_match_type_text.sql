-- Migration 021: Change match_type from enum to text
-- The v5 matching engine uses lowercase values ('strong', 'complementary', 'similar')
-- instead of the original enum ('SIMILAR', 'COMPLEMENTARY', 'RESONANT').
-- Converting to text avoids enum constraint violations on upsert.

ALTER TABLE wish_connections
  ALTER COLUMN match_type TYPE text;

DROP TYPE IF EXISTS match_type;
