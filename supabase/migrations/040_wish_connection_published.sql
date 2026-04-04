-- 040_wish_connection_published.sql
-- Adds a published flag to wish_connections.
-- A connection is published when its connection_enrichment.overall_connection_score > 70.
-- Only published connections are shown to users and trigger email notifications.
-- Admin screens see all connections regardless of published state.

alter table public.wish_connections
  add column if not exists published boolean not null default false;

create index if not exists idx_wish_connections_published
  on public.wish_connections (published);
