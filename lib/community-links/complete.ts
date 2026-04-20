/**
 * lib/community-links/complete.ts
 *
 * Shared business logic for completing a community identity link.
 * Called from both:
 *   - app/auth/callback/route.ts  (inline after OAuth/magic-link return)
 *   - app/api/community-links/complete/route.ts  (manual POST endpoint)
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { normalizeEmail } from './verify'

export interface CompleteLinkOk {
  ok:               true
  serverId:         string
  communityUserId:  string
}

export interface CompleteLinkError {
  ok:     false
  code:   string
  status: number
}

export type CompleteLinkResult = CompleteLinkOk | CompleteLinkError

/**
 * Complete a pending community identity link for an authenticated WoW user.
 *
 * Steps:
 *  1. Fetch pending handshake by token
 *  2. Check not expired
 *  3. Check not already consumed
 *  4. Verify authenticated email matches pending email
 *  5. Upsert permanent link row
 *  6. Mark pending as completed/consumed
 */
export async function completeCommunityLink(
  handshakeToken: string,
  user: User,
  admin: SupabaseClient,
): Promise<CompleteLinkResult> {

  // 1. Fetch pending handshake
  const { data: pending, error: fetchErr } = await admin
    .from('pending_identity_links')
    .select('*')
    .eq('handshake_token', handshakeToken)
    .single()

  if (fetchErr || !pending) {
    return { ok: false, code: 'HANDSHAKE_NOT_FOUND', status: 404 }
  }

  // 2. Check not expired
  if (new Date(pending.expires_at) < new Date()) {
    return { ok: false, code: 'HANDSHAKE_EXPIRED', status: 410 }
  }

  // 3. Check not already consumed
  if (pending.status !== 'pending' || pending.consumed_at) {
    return { ok: false, code: 'HANDSHAKE_ALREADY_CONSUMED', status: 409 }
  }

  // 4. Email must match — the only proof-of-identity mechanism
  const pendingEmail = normalizeEmail(pending.email)
  const userEmail    = normalizeEmail(user.email ?? '')

  if (!userEmail || pendingEmail !== userEmail) {
    // Log safely — no raw emails or tokens
    console.warn('[community-link] email mismatch', {
      server_id:         pending.server_id,
      community_user_id: pending.community_user_id,
    })
    return { ok: false, code: 'EMAIL_MISMATCH', status: 403 }
  }

  // 5. Upsert permanent link on wow_user_id.
  //    Each WoW user may hold exactly one community link globally.
  //    If a link already exists for this wow_user_id it is replaced.
  //    The (server_id, community_user_id) unique constraint still guards
  //    against a community identity being claimed by two WoW users.
  const now = new Date().toISOString()
  const { error: linkErr } = await admin
    .from('community_identity_links')
    .upsert(
      {
        wow_user_id:       user.id,
        community_user_id: pending.community_user_id,
        server_id:         pending.server_id,
        linked_email:      pendingEmail,
        link_status:       'linked',
        linked_at:         now,
        updated_at:        now,
      },
      { onConflict: 'wow_user_id' },
    )

  if (linkErr) {
    // Unique violation on (server_id, community_user_id) — community identity already claimed by another WoW user
    if (linkErr.code === '23505') {
      return { ok: false, code: 'LINK_CONFLICT', status: 409 }
    }
    console.error('[community-link] link upsert error:', linkErr.message, {
      server_id: pending.server_id,
    })
    return { ok: false, code: 'INTERNAL_ERROR', status: 500 }
  }

  // 6. Mark pending as consumed (best-effort; main link already created)
  await admin
    .from('pending_identity_links')
    .update({ status: 'completed', consumed_at: now })
    .eq('handshake_token', handshakeToken)

  console.log('[community-link] link created', {
    server_id:         pending.server_id,
    community_user_id: pending.community_user_id,
    wow_user_id:       user.id,
  })

  return {
    ok:               true,
    serverId:         pending.server_id,
    communityUserId:  pending.community_user_id,
  }
}
