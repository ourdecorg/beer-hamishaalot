-- Fix: match_wishes must bypass RLS to read embeddings of other users' public wishes.
-- Without SECURITY DEFINER, the "embeddings: owner only" RLS policy blocks cross-user
-- similarity search, causing findSimilarWishes to always return 0 results.

create or replace function match_wishes(
  query_embedding vector(1536),
  match_wish_id   uuid,
  match_count     int default 10
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
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
