-- ============================================================
-- באר המשאלות — Migration 003
-- Wish Resonance Engine: deep analysis, embeddings, connections
-- ============================================================

-- Enable pgvector extension
create extension if not exists vector;

-- ============================================================
-- Tables
-- ============================================================

-- Deep wish analysis (extends existing ai_summary/tags with structured fields)
create table public.wish_enrichment (
  wish_id            uuid primary key references public.wishes(id) on delete cascade,
  themes             text[]  not null default '{}',
  intent             text,
  needs              text[]  not null default '{}',
  skills_offered     text[]  not null default '{}',
  collaboration_type text,   -- 'build' | 'learn' | 'connect' | 'support' | 'share'
  emotional_tone     text,   -- 'hopeful' | 'urgent' | 'reflective' | 'excited' | 'uncertain'
  analyzed_at        timestamptz not null default now()
);

-- Vector embeddings (OpenAI text-embedding-3-small = 1536 dims)
create table public.wish_embeddings (
  wish_id    uuid primary key references public.wishes(id) on delete cascade,
  embedding  vector(1536) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Enums for connections
-- ============================================================

create type connection_status as enum (
  'suggested',    -- system proposed, no action yet
  'accepted_by_a',-- wish_a owner approved, waiting for wish_b owner
  'connected',    -- both approved — identities revealed
  'rejected'      -- either side rejected
);

create type match_type as enum (
  'SIMILAR',       -- both want similar things
  'COMPLEMENTARY', -- one has what the other needs
  'RESONANT'       -- deep alignment across all dimensions
);

-- Connection suggestions between wishes
-- canonical ordering: wish_a < wish_b (UUID lex order) prevents duplicate pairs
create table public.wish_connections (
  id           uuid primary key default gen_random_uuid(),
  wish_a       uuid not null references public.wishes(id) on delete cascade,
  wish_b       uuid not null references public.wishes(id) on delete cascade,
  match_score  float not null,
  match_type   match_type not null,
  status       connection_status not null default 'suggested',
  created_at   timestamptz not null default now(),
  unique(wish_a, wish_b),
  check(wish_a < wish_b)
);

-- ============================================================
-- Indexes
-- ============================================================

-- IVFFlat index for approximate nearest-neighbor search
-- Note: requires at least ~100 rows to be effective; sequential scan used below that
create index wish_embeddings_vec_idx
  on public.wish_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index wish_connections_a_idx    on public.wish_connections(wish_a);
create index wish_connections_b_idx    on public.wish_connections(wish_b);
create index wish_connections_score_idx on public.wish_connections(match_score desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.wish_enrichment  enable row level security;
alter table public.wish_embeddings  enable row level security;
alter table public.wish_connections enable row level security;

-- wish_enrichment: owner OR public wish
create policy "enrichment: owner or public wish"
  on public.wish_enrichment for select
  using (
    exists (
      select 1 from public.wishes w
      where w.id = wish_id
        and (w.user_id = auth.uid() or w.visibility in ('anonymous', 'open'))
    )
  );

create policy "enrichment: server can insert"
  on public.wish_enrichment for insert
  with check (true);

create policy "enrichment: server can update"
  on public.wish_enrichment for update
  using (true);

-- wish_embeddings: owner only (raw vectors are internal, not exposed to users)
create policy "embeddings: owner only"
  on public.wish_embeddings for select
  using (
    exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.user_id = auth.uid()
    )
  );

create policy "embeddings: server can insert"
  on public.wish_embeddings for insert
  with check (true);

-- wish_connections: participants only (owner of wish_a or wish_b)
create policy "connections: participant can select"
  on public.wish_connections for select
  using (
    exists (select 1 from public.wishes w where w.id = wish_a and w.user_id = auth.uid())
    or
    exists (select 1 from public.wishes w where w.id = wish_b and w.user_id = auth.uid())
  );

create policy "connections: server can insert"
  on public.wish_connections for insert
  with check (true);

create policy "connections: participant can update"
  on public.wish_connections for update
  using (
    exists (select 1 from public.wishes w where w.id = wish_a and w.user_id = auth.uid())
    or
    exists (select 1 from public.wishes w where w.id = wish_b and w.user_id = auth.uid())
  );

-- ============================================================
-- Helper function: cosine similarity search via pgvector
-- ============================================================

create or replace function match_wishes(
  query_embedding vector(1536),
  match_wish_id   uuid,
  match_count     int default 10
)
returns table (wish_id uuid, similarity float)
language sql stable
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
