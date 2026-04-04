-- 038_match_log_connection_rank.sql
-- Add connection_rank to match_attempts_log.
-- NULL  → candidate did not pass the relevance gate or threshold
-- 1     → highest-scoring match for this wish run
-- N     → Nth-best match; rows with rank > MAX_CONNECTIONS_PER_WISH were
--         capped and did NOT get a wish_connections row created.
alter table public.match_attempts_log
  add column if not exists connection_rank int null;
