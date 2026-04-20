/**
 * POST /api/community-links/complete
 *
 * Authenticated endpoint — called by the Communities frontend after the WoW
 * user has signed in.  Reads the handshake_token from the request body (or
 * falls back to the community_handshake httpOnly cookie set during the
 * /connect/community flow), then delegates to completeCommunityLink.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeCommunityLink } from '@/lib/community-links/complete'

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Resolve handshake token ────────────────────────────────────────────────
  let handshakeToken: string | null = null

  // Prefer body token (explicit API call)
  try {
    const body = await request.json()
    if (typeof body?.handshake_token === 'string') {
      handshakeToken = body.handshake_token
    }
  } catch {
    // no body — fall through to cookie
  }

  // Fallback: httpOnly cookie (set during /connect/community flow)
  if (!handshakeToken) {
    const cookieStore = await cookies()
    handshakeToken = cookieStore.get('community_handshake')?.value ?? null
  }

  if (!handshakeToken) {
    return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 })
  }

  // ── Complete the link ──────────────────────────────────────────────────────
  const admin = createAdminClient()
  const result = await completeCommunityLink(handshakeToken, user, admin)

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status })
  }

  // Clear the cookie after successful link
  const cookieStore = await cookies()
  cookieStore.delete('community_handshake')

  return NextResponse.json({
    status:             'ok',
    server_id:          result.serverId,
    community_user_id:  result.communityUserId,
  })
}
