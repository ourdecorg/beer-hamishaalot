-- ============================================================
-- Migration 032: Cancelled wish cleanup
-- ============================================================

-- Ensure status column exists (guard for prod DBs missing it)
alter table public.wishes
  add column if not exists status text not null default 'pending';

-- Add 'deleted' to connection_status enum
alter type connection_status add value if not exists 'deleted';

-- Update match_wishes to exclude cancelled wishes
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
    and w.status != 'cancelled'
    and (not only_lower_id or e.wish_id < match_wish_id)
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding;
$$;

-- Update find_structured_candidates to exclude cancelled wishes
create or replace function find_structured_candidates(
  source_wish_id  uuid,
  source_keywords text[],
  only_lower_id   boolean default false
)
returns table (wish_id uuid)
language sql stable
security definer
set search_path = public
as $$
  select e.wish_id
  from public.wish_enrichment e
  join public.wishes w on w.id = e.wish_id
  where e.wish_id != source_wish_id
    and w.visibility in ('anonymous', 'open')
    and w.status != 'cancelled'
    and e.anchor_keywords && source_keywords
    and (not only_lower_id or e.wish_id < source_wish_id)
$$;
