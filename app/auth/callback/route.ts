import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeCommunityLink } from '@/lib/community-links/complete'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/wishes/new'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // ── Community link handshake ─────────────────────────────────────────
      const handshakeToken = cookieStore.get('community_handshake')?.value
      if (handshakeToken) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const admin = createAdminClient()
          const result = await completeCommunityLink(handshakeToken, user, admin)
          cookieStore.delete('community_handshake')

          if (!result.ok) {
            if (result.code === 'EMAIL_MISMATCH') {
              // User authenticated with the wrong email — redirect back to the
              // connect page so the mismatch screen is shown with the login form.
              const appBase = process.env.APP_URL ?? origin
              return NextResponse.redirect(
                `${appBase}/connect/community?token=${encodeURIComponent(handshakeToken)}&error=email_mismatch`,
              )
            }
            if (result.code !== 'HANDSHAKE_ALREADY_CONSUMED') {
              console.warn('[auth/callback] community link failed', { code: result.code })
            }
          }
        }
      }

      // APP_URL overrides the internal Railway origin (localhost:8080)
      const appBase = process.env.APP_URL ?? origin
      return NextResponse.redirect(`${appBase}${next}`)
    }
  }

  // Auth error — redirect to login with error param
  const appBase = process.env.APP_URL ?? origin
  return NextResponse.redirect(`${appBase}/login?error=auth`)
}
