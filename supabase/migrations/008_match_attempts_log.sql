-- Migration 008: Match attempts log
-- Records every scoring attempt in the resonance engine, including attempts
-- that did not pass the MATCH_THRESHOLD. Used for debugging and tuning.

create table public.match_attempts_log (
  id                    uuid primary key default gen_random_uuid(),
  wish_id               uuid not null references public.wishes(id) on delete cascade,
  candidate_wish_id     uuid not null references public.wishes(id) on delete cascade,
  semantic_similarity   float not null,
  complementarity_score float not null,
  theme_overlap         float not null,
  match_score           float not null,
  match_type            text,           -- null if below threshold
  passed_threshold      boolean not null,
  created_at            timestamptz not null default now()
);

create index match_attempts_log_wish_idx      on public.match_attempts_log(wish_id);
create index match_attempts_log_candidate_idx on public.match_attempts_log(candidate_wish_id);
create index match_attempts_log_score_idx     on public.match_attempts_log(match_score desc);

-- No RLS needed — internal server-only table (admin client only)
alter table public.match_attempts_log enable row level security;
