/**
 * GET /api/community-links/me
 *
 * Returns all community identity links for the authenticated WoW user.
 * Useful for account settings / profile pages.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch links ────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: links, error } = await admin
    .from('community_identity_links')
    .select('id, server_id, community_user_id, linked_email, link_status, linked_at')
    .eq('wow_user_id', user.id)
    .order('linked_at', { ascending: false })

  if (error) {
    console.error('[community-links/me] fetch error:', error.message)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ links: links ?? [] })
}
