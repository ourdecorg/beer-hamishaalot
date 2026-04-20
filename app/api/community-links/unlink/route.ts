/**
 * POST /api/community-links/unlink
 *
 * Marks a community identity link as 'unlinked'.
 * The row is kept for audit; future re-linking will upsert over it.
 *
 * Body: { link_id: string }   (the UUID from community_identity_links)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let link_id: string | undefined
  try {
    const body = await request.json()
    link_id = typeof body?.link_id === 'string' ? body.link_id : undefined
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  if (!link_id) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  // ── Verify ownership and unlink ────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: link } = await admin
    .from('community_identity_links')
    .select('id, wow_user_id, link_status')
    .eq('id', link_id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Users may only unlink their own records
  if (link.wow_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (link.link_status === 'unlinked') {
    return NextResponse.json({ status: 'ok', already_unlinked: true })
  }

  const { error } = await admin
    .from('community_identity_links')
    .update({ link_status: 'unlinked', updated_at: new Date().toISOString() })
    .eq('id', link_id)

  if (error) {
    console.error('[community-links/unlink] update error:', error.message)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  console.log('[community-links/unlink] unlinked', { link_id, wow_user_id: user.id })

  return NextResponse.json({ status: 'ok' })
}
