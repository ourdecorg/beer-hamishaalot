/**
 * POST /api/community-links/initiate
 *
 * Server-to-server endpoint — called by the Communities backend.
 * No Supabase user session required; authentication is via HMAC signature.
 *
 * On success returns a handshake_token + link_url the Communities frontend
 * should redirect the user to.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyClientKey,
  verifyHmacSignature,
  verifyTimestampFreshness,
  checkAndStoreNonce,
  generateHandshakeToken,
  handshakeExpiresAt,
  normalizeEmail,
} from '@/lib/community-links/verify'

function err(code: string, status: number) {
  return NextResponse.json({ error: code }, { status })
}

export async function POST(request: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return err('INVALID_PAYLOAD', 400)
  }

  const { community_user_id, server_id, email, display_name, timestamp, nonce } = body as {
    community_user_id?: string
    server_id?:         string
    email?:             string
    display_name?:      string
    timestamp?:         string
    nonce?:             string
  }

  if (!community_user_id || !server_id || !email || !timestamp || !nonce) {
    return err('INVALID_PAYLOAD', 400)
  }

  // ── Header extraction ───────────────────────────────────────────────────────
  const clientKey = request.headers.get('x-community-key')
  const sigTimestamp = request.headers.get('x-timestamp') ?? timestamp
  const sigNonce     = request.headers.get('x-nonce')     ?? nonce
  const signature    = request.headers.get('x-signature')

  // ── Verify client key ───────────────────────────────────────────────────────
  if (!verifyClientKey(clientKey)) {
    console.warn('[community-link/initiate] invalid client key', { server_id })
    return err('INVALID_CLIENT_KEY', 401)
  }

  // ── Verify HMAC signature ───────────────────────────────────────────────────
  if (!verifyHmacSignature(body, sigTimestamp, sigNonce, signature)) {
    console.warn('[community-link/initiate] invalid signature', { server_id })
    return err('INVALID_SIGNATURE', 401)
  }

  // ── Verify timestamp freshness ──────────────────────────────────────────────
  if (!verifyTimestampFreshness(timestamp)) {
    console.warn('[community-link/initiate] expired timestamp', { server_id })
    return err('EXPIRED_REQUEST', 400)
  }

  const admin = createAdminClient()

  // ── Verify nonce uniqueness ─────────────────────────────────────────────────
  let nonceOk: boolean
  try {
    nonceOk = await checkAndStoreNonce(nonce, admin)
  } catch (e) {
    console.error('[community-link/initiate] nonce store error:', e)
    return err('INTERNAL_ERROR', 500)
  }
  if (!nonceOk) {
    console.warn('[community-link/initiate] nonce reused', { server_id })
    return err('NONCE_ALREADY_USED', 409)
  }

  // ── Check not already linked ────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('community_identity_links')
    .select('id, link_status')
    .eq('server_id',         server_id)
    .eq('community_user_id', community_user_id)
    .single()

  if (existing?.link_status === 'linked') {
    console.log('[community-link/initiate] already linked', {
      server_id,
      community_user_id,
    })
    return err('ALREADY_LINKED', 409)
  }
  // 'unlinked' status → allow re-linking, fall through

  // ── Create pending handshake ────────────────────────────────────────────────
  const handshakeToken = generateHandshakeToken()
  const expiresAt      = handshakeExpiresAt()

  const { error: insertErr } = await admin.from('pending_identity_links').insert({
    handshake_token:   handshakeToken,
    community_user_id,
    server_id,
    email:             normalizeEmail(email),
    display_name:      display_name ?? null,
    nonce,
    request_timestamp: timestamp,
    expires_at:        expiresAt.toISOString(),
  })

  if (insertErr) {
    console.error('[community-link/initiate] insert error:', insertErr.message)
    return err('INTERNAL_ERROR', 500)
  }

  const appUrl  = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const linkUrl = `${appUrl}/connect/community?token=${handshakeToken}`

  console.log('[community-link/initiate] handshake created', {
    server_id,
    community_user_id,
    expires_at: expiresAt.toISOString(),
  })

  return NextResponse.json({
    status:          'ok',
    handshake_token: handshakeToken,
    link_url:        linkUrl,
    expires_at:      expiresAt.toISOString(),
  })
}
