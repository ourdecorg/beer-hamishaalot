-- Migration 004: Remove two-sided approval — all connections are immediately connected.

-- Update any existing 'suggested' or 'accepted_by_a' connections to 'connected'
update public.wish_connections
set status = 'connected'
where status in ('suggested', 'accepted_by_a');

-- Change the default so new connections are 'connected' from the start
alter table public.wish_connections
  alter column status set default 'connected';
