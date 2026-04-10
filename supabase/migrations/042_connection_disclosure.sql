-- 042_connection_disclosure.sql
-- Adds per-side disclosure columns to wish_connections.
--
-- Design rationale:
--   "user_a" = owner of wish_a (canonical: wish_a < wish_b by UUID string ordering)
--   "user_b" = owner of wish_b
--
--   Acceptance and disclosure are conceptually distinct:
--     - response:  the user's decision (accepted / declined / later)
--     - shared_fields_json:  which profile fields the user chose to share
--     - shared_profile_snapshot_json:  immutable copy of those field values at acceptance time
--     - intro_message:  optional personal note attached to the acceptance
--
--   mutual_accepted_at is set ONLY when BOTH user_a_response = 'accepted'
--   AND user_b_response = 'accepted'. This is the gate for revealing personal
--   details — before that timestamp, no identity is shown to either side.
--
--   State derivation (computed in application layer, not stored):
--     pending          — both sides still 'pending' or 'later'
--     one_side_accepted— one 'accepted', other 'pending'/'later'
--     mutual_accept    — mutual_accepted_at IS NOT NULL
--     declined         — either side is 'declined'
--
--   Existing connections (created before this migration) will default to
--   user_a_response = 'pending', user_b_response = 'pending', requiring
--   explicit acceptance before personal details are revealed.

alter table public.wish_connections
  add column if not exists user_a_response                    text        not null default 'pending'
    check (user_a_response in ('pending', 'accepted', 'declined', 'later')),
  add column if not exists user_a_shared_fields_json          jsonb,
  add column if not exists user_a_shared_profile_snapshot_json jsonb,
  add column if not exists user_a_intro_message               text,
  add column if not exists user_a_responded_at                timestamptz,

  add column if not exists user_b_response                    text        not null default 'pending'
    check (user_b_response in ('pending', 'accepted', 'declined', 'later')),
  add column if not exists user_b_shared_fields_json          jsonb,
  add column if not exists user_b_shared_profile_snapshot_json jsonb,
  add column if not exists user_b_intro_message               text,
  add column if not exists user_b_responded_at                timestamptz,

  add column if not exists mutual_accepted_at                 timestamptz;

-- Index for fast lookup of connections awaiting a specific side's response
create index if not exists idx_wc_user_a_response on public.wish_connections (user_a_response);
create index if not exists idx_wc_user_b_response on public.wish_connections (user_b_response);
create index if not exists idx_wc_mutual_accepted  on public.wish_connections (mutual_accepted_at)
  where mutual_accepted_at is not null;
