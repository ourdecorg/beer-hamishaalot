-- Migration 026: dual recall — anchor_keywords + structured candidate search
--
-- anchor_keywords: canonical keyword IDs derived from needs + skills_offered
--                  + subject_entities + domain_entities. Stored in wish_enrichment
--                  and queried via PostgreSQL && (array overlap) for structural recall.
--
-- find_structured_candidates: RPC that returns wishes whose anchor_keywords overlap
--   with the source wish — i.e. candidates that are likely complementary even when
--   semantic (vector) similarity is low.
--
-- match_attempts_log additions:
--   structural_similarity: field-level overlap score (0/0.25/0.5/0.75/1.0)
--   recall_source: how the candidate was found ('semantic'|'structured'|'both')

-- 1. New column on wish_enrichment
alter table public.wish_enrichment
  add column if not exists anchor_keywords text[] not null default '{}';

-- 2. GIN index for efficient array overlap (&&) queries
create index if not exists idx_wish_enrichment_anchor_keywords
  on public.wish_enrichment using gin(anchor_keywords);

-- 3. New log columns
alter table public.match_attempts_log
  add column if not exists structural_similarity double precision;

alter table public.match_attempts_log
  add column if not exists recall_source text;

-- 4. Structured candidate recall function
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
    and e.anchor_keywords && source_keywords
    and (not only_lower_id or e.wish_id < source_wish_id)
$$;
