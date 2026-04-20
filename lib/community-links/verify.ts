/**
 * lib/community-links/verify.ts
 *
 * Utilities for the WoW ↔ Communities System server-to-server handshake.
 *
 * SIGNING ALGORITHM (for Communities System implementors):
 *   message        = "{X-Timestamp}\n{X-Nonce}\n{canonical_body}"
 *   canonical_body = JSON.stringify of request body with keys sorted A–Z, no extra whitespace
 *   signature      = HMAC-SHA256(message, COMMUNITY_LINK_SHARED_SECRET) as lowercase hex
 *   headers        = X-Community-Key, X-Timestamp, X-Nonce, X-Signature
 *
 * Required env vars:
 *   COMMUNITY_LINK_SHARED_SECRET   — shared HMAC secret (never expose publicly)
 *   COMMUNITY_LINK_CLIENT_KEY      — static API key sent in X-Community-Key header
 */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const TIMESTAMP_WINDOW_MS  = 5 * 60 * 1000  // 5 minutes
const HANDSHAKE_EXPIRY_MIN = 10              // minutes until link URL expires

// ── Email ─────────────────────────────────────────────────────────────────────

/** Normalize email before storage and comparison — lowercase + trim */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

// ── Client key ────────────────────────────────────────────────────────────────

/** Verify the X-Community-Key header matches the configured value */
export function verifyClientKey(key: string | null): boolean {
  const expected = process.env.COMMUNITY_LINK_CLIENT_KEY
  if (!expected || !key) return false
  // Constant-time comparison even for key check
  const a = Buffer.from(expected)
  const b = Buffer.from(key)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── HMAC signature ────────────────────────────────────────────────────────────

/**
 * Build the canonical signed message.
 * Sort body keys alphabetically for deterministic serialisation.
 */
function buildSignatureMessage(
  timestamp: string,
  nonce: string,
  body: Record<string, unknown>,
): string {
  const sorted = Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b)))
  return `${timestamp}\n${nonce}\n${JSON.stringify(sorted)}`
}

/**
 * Verify HMAC-SHA256 signature using a constant-time comparison.
 * Returns false if the secret is unconfigured — never trusts by default.
 */
export function verifyHmacSignature(
  body: Record<string, unknown>,
  timestamp: string,
  nonce: string,
  signature: string | null,
): boolean {
  const secret = process.env.COMMUNITY_LINK_SHARED_SECRET
  if (!secret || !signature) return false

  const message  = buildSignatureMessage(timestamp, nonce, body)
  const expected = createHmac('sha256', secret).update(message, 'utf8').digest('hex')

  // timingSafeEqual requires same-length buffers; compare as ASCII strings
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── Timestamp ─────────────────────────────────────────────────────────────────

/**
 * Reject requests whose timestamp is outside the freshness window.
 * Accepts ISO 8601 strings (UTC).
 */
export function verifyTimestampFreshness(timestamp: string): boolean {
  const ts = Date.parse(timestamp)
  if (isNaN(ts)) return false
  return Math.abs(Date.now() - ts) <= TIMESTAMP_WINDOW_MS
}

// ── Nonce ─────────────────────────────────────────────────────────────────────

/**
 * Atomically check-and-store a nonce.
 * Returns true  — nonce is fresh; it has been written to used_nonces.
 * Returns false — nonce was already used (or is empty).
 * Throws on unexpected DB errors.
 */
export async function checkAndStoreNonce(
  nonce: string,
  admin: SupabaseClient,
): Promise<boolean> {
  if (!nonce) return false

  const { error } = await admin.from('used_nonces').insert({ nonce })

  if (error) {
    if (error.code === '23505') return false  // unique violation = already used
    throw error
  }
  return true
}

// ── Token ─────────────────────────────────────────────────────────────────────

/** Generate a cryptographically random handshake token (hl_ prefix + 64 hex chars) */
export function generateHandshakeToken(): string {
  return 'hl_' + randomBytes(32).toString('hex')
}

/** Compute the expiry timestamp for a new handshake */
export function handshakeExpiresAt(): Date {
  return new Date(Date.now() + HANDSHAKE_EXPIRY_MIN * 60 * 1000)
}
