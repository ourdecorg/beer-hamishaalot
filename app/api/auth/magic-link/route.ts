/**
 * POST /api/auth/magic-link
 *
 * Server-side magic link sender.
 * Uses APP_URL runtime env var (not baked at build time) so the emailRedirectTo
 * always points to the correct production domain, regardless of where the
 * request originates from (e.g. Railway internal localhost:8080).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = await request.json()
    email = body.email?.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // APP_URL is a server-side runtime variable — always reflects the real domain
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  const emailRedirectTo = appUrl
    ? `${appUrl}/auth/callback`
    : undefined  // let Supabase use its configured Site URL as fallback

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
