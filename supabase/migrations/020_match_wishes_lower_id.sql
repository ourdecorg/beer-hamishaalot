-- Migration 020: add only_lower_id parameter to match_wishes
--
-- When set to true, returns only candidates whose wish_id < match_wish_id
-- (UUID string comparison). This halves the work during batch re-processing:
-- each pair (A, B) is scored exactly once — when the wish with the larger ID
-- is processed — instead of twice.
--
-- Run in Supabase SQL Editor.

create or replace function match_wishes(
  query_embedding  vector(1536),
  match_wish_id    uuid,
  min_similarity   float default 0.1,
  only_lower_id    boolean default false
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
    and (not only_lower_id or e.wish_id < match_wish_id)
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding;
$$;
