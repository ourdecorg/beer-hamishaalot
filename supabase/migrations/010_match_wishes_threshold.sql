-- Optimisation: add min_similarity threshold to match_wishes so the scoring
-- pipeline only receives candidates with cosine similarity ≥ threshold.
-- This changes complexity from O(N) candidates per wish to O(K) where K << N,
-- making overall matching sub-quadratic as the dataset grows.

create or replace function match_wishes(
  query_embedding vector(1536),
  match_wish_id   uuid,
  min_similarity  float default 0.1
)
returns table (wish_id uuid, similarity float)
language sql stable
security definer
set search_path = public
as $$
  select
    e.wish_id,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.wish_embeddings e
  join public.wishes w on w.id = e.wish_id
  where e.wish_id != match_wish_id
    and w.visibility in ('anonymous', 'open')
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding;
$$;
