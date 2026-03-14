-- Migration 006: Personalized feed infrastructure.
--
-- Adds a SECURITY DEFINER RPC that runs as the function owner, bypassing the
-- "owner-only" RLS on wish_embeddings so the feed engine can compute cosine
-- similarity against all public wishes — not just the caller's own.
--
-- The function filters to public wishes (visibility in ('anonymous','open')) and
-- excludes the calling user's own wishes, so no private data leaks.

create or replace function feed_match_wishes(
  query_embedding  vector(1536),
  exclude_user_id  uuid,
  match_count      int default 30
)
returns table (wish_id uuid, similarity float)
language sql stable
security definer
set search_path = public, pg_catalog
as $$
  select e.wish_id,
         1 - (e.embedding <=> query_embedding) as similarity
  from   wish_embeddings e
  join   wishes w on w.id = e.wish_id
  where  w.user_id    != exclude_user_id
    and  w.visibility in ('anonymous', 'open')
  order by e.embedding <=> query_embedding
  limit  match_count;
$$;

-- Allow authenticated users to call this function
grant execute on function feed_match_wishes(vector, uuid, int) to authenticated;
