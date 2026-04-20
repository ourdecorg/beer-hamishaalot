'use server'

/**
 * Server Actions for the community connect flow.
 *
 * Server Actions can set httpOnly cookies; Server Components and Client
 * Components cannot do so directly.  The cookie must survive a full
 * Google OAuth redirect cycle, so httpOnly + Secure + SameSite=Lax is correct.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const COOKIE_NAME    = 'community_handshake'
const COOKIE_MAX_AGE = 15 * 60  // 15 minutes — well beyond the 10-min handshake expiry

/** Persist the handshake token in a httpOnly cookie, then trigger Google OAuth */
export async function loginWithGoogleForCommunity(handshakeToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, handshakeToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  })

  const appUrl    = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const next      = '/connect/community/success'
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
  })

  if (error || !data.url) {
    // Redirect back to the connect page with an error flag
    redirect(`/connect/community?token=${handshakeToken}&error=google`)
  }

  redirect(data.url)
}

/** Persist the handshake token in a httpOnly cookie, then send a magic-link email */
export async function sendMagicLinkForCommunity(handshakeToken: string, email: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, handshakeToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  })

  const appUrl         = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const next           = '/connect/community/success'
  const emailRedirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
