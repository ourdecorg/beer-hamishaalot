-- migration 036: per-term embeddings for embedding-based complementarity scoring
-- Each need and skill_offered is stored as a separate vector.
-- Scoring at runtime uses pairwise cosine similarity (JS only, no OpenAI call).

create table public.wish_term_embeddings (
  id          uuid primary key default gen_random_uuid(),
  wish_id     uuid not null references public.wishes(id) on delete cascade,
  term_type   text not null check (term_type in ('need', 'skill')),
  term_text   text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz default now()
);

create index wish_term_embeddings_wish_id_idx
  on public.wish_term_embeddings(wish_id);
