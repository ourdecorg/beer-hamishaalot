-- Fix: match_wishes previously returned only the top N results (default 10),
-- meaning a new wish was only compared against a small subset of existing wishes.
-- Remove the limit so every public wish is evaluated as a candidate.

create or replace function match_wishes(
  query_embedding vector(1536),
  match_wish_id   uuid
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
  order by e.embedding <=> query_embedding;
$$;
