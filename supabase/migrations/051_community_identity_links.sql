-- 051_community_identity_links.sql
--
-- Three tables for the WoW ↔ Communities System account-linking flow:
--   1. community_identity_links  — permanent mapping (wow_user ↔ community_user)
--   2. pending_identity_links    — short-lived handshake during auth
--   3. used_nonces               — replay-attack protection
--
-- All tables are backend/service-role only. No user-facing RLS policies.
-- Access exclusively through API routes using createAdminClient().

-- ── 1. Permanent links ────────────────────────────────────────────────────────

CREATE TABLE public.community_identity_links (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wow_user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_user_id text        NOT NULL,
  server_id         text        NOT NULL,
  linked_email      text        NOT NULL,
  link_status       text        NOT NULL DEFAULT 'linked'
                                CHECK (link_status IN ('linked', 'unlinked')),
  linked_at         timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Each (server, community_user) pair may only be linked once
  UNIQUE (server_id, community_user_id),
  -- Each WoW user may only have one link per server
  UNIQUE (wow_user_id, server_id)
);

CREATE INDEX idx_cil_wow_user  ON public.community_identity_links (wow_user_id);
CREATE INDEX idx_cil_server    ON public.community_identity_links (server_id);

ALTER TABLE public.community_identity_links ENABLE ROW LEVEL SECURITY;
-- No policies → only service role can access

-- ── 2. Pending handshakes ─────────────────────────────────────────────────────

CREATE TABLE public.pending_identity_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  handshake_token     text        NOT NULL UNIQUE,
  community_user_id   text        NOT NULL,
  server_id           text        NOT NULL,
  email               text        NOT NULL,
  display_name        text,
  nonce               text        NOT NULL,
  request_timestamp   timestamptz NOT NULL,
  expires_at          timestamptz NOT NULL,
  consumed_at         timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'completed', 'expired')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pil_token    ON public.pending_identity_links (handshake_token);
CREATE INDEX idx_pil_expires  ON public.pending_identity_links (expires_at);
CREATE INDEX idx_pil_server   ON public.pending_identity_links (server_id, community_user_id);

ALTER TABLE public.pending_identity_links ENABLE ROW LEVEL SECURITY;
-- No policies → only service role can access

-- ── 3. Used nonces (replay protection) ───────────────────────────────────────

CREATE TABLE public.used_nonces (
  nonce      text        PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index supports a scheduled cleanup job (delete nonces older than N days)
CREATE INDEX idx_used_nonces_created ON public.used_nonces (created_at);

ALTER TABLE public.used_nonces ENABLE ROW LEVEL SECURITY;
-- No policies → only service role can access
