-- 039_connection_enrichment.sql
-- Stores GPT-4o enrichment for each surviving wish-connection pair.
-- One row per canonical (wish_a_id, wish_b_id) pair (wish_a_id < wish_b_id).
-- Idempotent: pair is not re-enriched unless enrichment is deleted or forced.

create table if not exists public.connection_enrichment (
  id                        uuid        primary key default gen_random_uuid(),

  -- Canonical pair (same ordering as wish_connections.wish_a / wish_b)
  wish_a_id                 uuid        not null references public.wishes(id) on delete cascade,
  wish_b_id                 uuid        not null references public.wishes(id) on delete cascade,

  -- Scores (0–100)
  resonance_score           int         not null check (resonance_score between 0 and 100),
  collaboration_depth_score int         not null check (collaboration_depth_score between 0 and 100),
  overall_connection_score  int         not null check (overall_connection_score between 0 and 100),
  confidence                int         not null check (confidence between 0 and 100),

  -- Relationship classification
  relationship_type         text        not null,

  -- Bilingual explanations (JSONB: { he, en })
  why                       jsonb       not null default '{}',
  opportunity_for_wish_a    jsonb       not null default '{}',
  opportunity_for_wish_b    jsonb       not null default '{}',
  shared_basis              jsonb       not null default '{}',
  risks_or_limits           jsonb       not null default '{}',

  -- Traceability
  model                     text        not null,
  prompt_version            text        not null,
  enriched_at               timestamptz not null default now(),

  -- One enrichment row per pair
  unique (wish_a_id, wish_b_id)
);

-- Index for fast lookup by either wish in a pair
create index if not exists idx_conn_enrichment_wish_a on public.connection_enrichment (wish_a_id);
create index if not exists idx_conn_enrichment_wish_b on public.connection_enrichment (wish_b_id);

-- Admin-only via service role; no RLS needed for direct server use
alter table public.connection_enrichment enable row level security;
