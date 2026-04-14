-- 049_peek_exclude_user.sql
-- Update peek_wishes() to accept an optional exclude_user_id parameter.
-- When provided, wishes owned by that user are excluded from results,
-- ensuring logged-in users only see wishes from other users.

CREATE OR REPLACE FUNCTION public.peek_wishes(
  query_embedding  vector(1536),
  min_similarity   float   DEFAULT 0.2,
  match_limit      int     DEFAULT 10,
  exclude_user_id  uuid    DEFAULT NULL
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
   AND (exclude_user_id IS NULL OR w.user_id != exclude_user_id)
  LEFT JOIN wish_enrichment e ON e.wish_id = w.id
  WHERE (1 - (we.embedding <=> query_embedding)) >= min_similarity
  ORDER BY we.embedding <=> query_embedding
  LIMIT match_limit
$$;
