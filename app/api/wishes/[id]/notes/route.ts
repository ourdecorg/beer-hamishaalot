/**
 * POST /api/wishes/[id]/notes
 *
 * Public endpoint — no login required.
 * Lets any visitor leave a note (פתק) on an open wish via the Peek feature.
 * The note is visible only to the wish owner.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const wishId = params.id
  const body   = await request.json().catch(() => ({}))

  const message     = typeof body.message     === 'string' ? body.message.trim()     : ''
  const senderName  = typeof body.sender_name  === 'string' ? body.sender_name.trim()  : ''
  const senderEmail = typeof body.sender_email === 'string' ? body.sender_email.trim() : ''

  if (!message || message.length > 1000) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify wish exists, is open and not cancelled
  const { data: wish } = await admin
    .from('wishes')
    .select('id, status, visibility')
    .eq('id', wishId)
    .single()

  if (!wish || wish.status === 'cancelled' || wish.visibility !== 'open') {
    return NextResponse.json({ error: 'wish_not_found' }, { status: 404 })
  }

  // Attach sender user id if logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await admin.from('wish_notes').insert({
    wish_id:        wishId,
    sender_user_id: user?.id ?? null,
    sender_name:    senderName  || null,
    sender_email:   senderEmail || null,
    message,
  })

  if (error) {
    console.error('[notes] insert error:', error.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
