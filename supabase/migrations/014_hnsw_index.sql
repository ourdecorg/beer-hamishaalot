-- Migration 014: replace IVFFlat with HNSW for wish_embeddings
--
-- IVFFlat (lists=50) requires knowing the dataset size in advance and
-- its performance degrades as the table grows beyond the optimal row count.
-- HNSW maintains consistent query performance regardless of dataset size
-- and does not require periodic rebuilds.
--
-- Run in Supabase SQL Editor. Building the HNSW index may take a few
-- seconds depending on the number of existing embeddings.

-- Drop old IVFFlat index
drop index if exists public.wish_embeddings_vec_idx;

-- Create HNSW index
-- m=16: connections per node (default, good balance of memory vs. speed)
-- ef_construction=64: candidates considered during index build (quality)
create index if not exists wish_embeddings_hnsw_idx
  on public.wish_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Restore match_wishes as a plain sql stable function.
-- hnsw.ef_search defaults to 40 in pgvector — no need to SET LOCAL,
-- which is forbidden inside STABLE functions.
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
