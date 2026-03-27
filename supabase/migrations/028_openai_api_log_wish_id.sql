-- ============================================================
-- Migration 028: Add wish_id to openai_api_log
-- ============================================================

alter table public.openai_api_log
  add column if not exists wish_id uuid references public.wishes(id) on delete set null;

-- Index for fast per-wish log lookups
create index if not exists openai_api_log_wish_id_idx
  on public.openai_api_log (wish_id)
  where wish_id is not null;
