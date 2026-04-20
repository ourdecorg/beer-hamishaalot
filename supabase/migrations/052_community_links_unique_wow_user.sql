-- 052_community_links_unique_wow_user.sql
--
-- Enforce that each wow_user_id may only hold ONE community link (globally,
-- not just per-server).  Replace the (wow_user_id, server_id) composite
-- unique constraint with a simple UNIQUE (wow_user_id).

ALTER TABLE public.community_identity_links
  DROP CONSTRAINT IF EXISTS community_identity_links_wow_user_id_server_id_key;

ALTER TABLE public.community_identity_links
  ADD CONSTRAINT community_identity_links_wow_user_id_key
    UNIQUE (wow_user_id);
