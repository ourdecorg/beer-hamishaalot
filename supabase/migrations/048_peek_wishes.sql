-- 048_peek_wishes.sql
-- Public RPC for the "Peek into the Well" feature.
-- Finds open, consented wishes semantically similar to an arbitrary input embedding.
--
-- SECURITY DEFINER lets anonymous callers invoke this function while the
-- function itself reads wish_embeddings (which is RLS-protected, owner-only).
-- The WHERE clause is the security boundary: only open, non-cancelled,
-- consent=true wishes are ever returned.

CREATE OR REPLACE FUNCTION public.peek_wishes(
  query_embedding vector(1536),
  min_similarity  float  DEFAULT 0.2,
  match_limit     int    DEFAULT 10
)
RETURNS TABLE (
  wish_id            uuid,
  original_text      text,
  similarity         float,
  emotional_tone     text,
  collaboration_type text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    w.id                                     AS wish_id,
    w.original_text,
    (1 - (we.embedding <=> query_embedding)) AS similarity,
    e.emotional_tone,
    e.collaboration_type
  FROM wish_embeddings we
  JOIN wishes w
    ON w.id = we.wish_id
   AND w.status     != 'cancelled'
   AND w.visibility  = 'open'
   AND w.consent_to_match_sharing = true
  LEFT JOIN wish_enrichment e ON e.wish_id = w.id
  WHERE (1 - (we.embedding <=> query_embedding)) >= min_similarity
  ORDER BY we.embedding <=> query_embedding
  LIMIT match_limit
$$;
