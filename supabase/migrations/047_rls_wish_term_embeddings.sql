-- 047_rls_wish_term_embeddings.sql
-- Enable RLS on wish_term_embeddings (table created in 036 without RLS).
-- Server-side (admin client) reads/writes bypass RLS automatically.
-- No user-facing policy needed — this table is internal to the matching engine.

alter table public.wish_term_embeddings enable row level security;
