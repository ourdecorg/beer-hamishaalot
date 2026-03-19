-- Migration 015: OpenAI API call log
--
-- Records every request to the OpenAI API with timing and payload details.
-- The embedding vector itself is NOT stored (it lives in wish_embeddings).
-- Run in Supabase SQL Editor.

create table public.openai_api_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now() not null,
  caller      text        not null,   -- function name, e.g. 'analyzeWishText'
  model       text        not null,   -- e.g. 'gpt-4o', 'text-embedding-3-small'
  request     jsonb       not null,   -- request payload (messages / input text)
  response    jsonb,                  -- response payload (null on error)
  error       text,                   -- error message if the call failed
  elapsed_ms  integer     not null    -- wall-clock time between request and response
);

-- Index for filtering by caller or model in the admin UI
create index openai_api_log_caller_idx on public.openai_api_log (caller);
create index openai_api_log_model_idx  on public.openai_api_log (model);
create index openai_api_log_created_at_idx on public.openai_api_log (created_at desc);

-- Only service-role can write; no public read
alter table public.openai_api_log enable row level security;
