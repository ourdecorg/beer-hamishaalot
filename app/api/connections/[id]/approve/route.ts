/**
 * POST /api/connections/[id]/approve
 *
 * Advances a connection through its approval state machine:
 *
 *   suggested      + wish_a owner → accepted_by_a
 *   accepted_by_a  + wish_b owner → connected  (identities revealed)
 *
 * Either party can also reject at any stage.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional body: { action: 'approve' | 'reject' }
  let action: 'approve' | 'reject' = 'approve'
  try {
    const body = await request.json()
    if (body.action === 'reject') action = 'reject'
  } catch {
    // No body or invalid JSON — default to approve
  }

  // Fetch the connection
  const { data: conn } = await supabase
    .from('wish_connections')
    .select('id, wish_a, wish_b, status')
    .eq('id', params.id)
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  if (conn.status === 'connected' || conn.status === 'rejected') {
    return NextResponse.json({ error: 'Connection already finalised', status: conn.status }, { status: 409 })
  }

  // Determine which side the user is on
  const { data: wishA } = await supabase
    .from('wishes')
    .select('user_id')
    .eq('id', conn.wish_a)
    .single()

  const { data: wishB } = await supabase
    .from('wishes')
    .select('user_id')
    .eq('id', conn.wish_b)
    .single()

  const isOwnerA = wishA?.user_id === user.id
  const isOwnerB = wishB?.user_id === user.id

  if (!isOwnerA && !isOwnerB) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rejection: either party can reject at any time
  if (action === 'reject') {
    const { error } = await supabase
      .from('wish_connections')
      .update({ status: 'rejected' })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ status: 'rejected' })
  }

  // State machine for approval
  let newStatus: string | null = null

  if (conn.status === 'suggested' && isOwnerA) {
    newStatus = 'accepted_by_a'
  } else if (conn.status === 'suggested' && isOwnerB) {
    // B can also initiate — treat as if A went first (becomes accepted_by_a)
    // Reuse accepted_by_a to mean "one side approved, waiting for the other"
    newStatus = 'accepted_by_a'
  } else if (conn.status === 'accepted_by_a' && isOwnerA) {
    return NextResponse.json({ error: 'You already approved. Waiting for the other side.' }, { status: 409 })
  } else if (conn.status === 'accepted_by_a' && isOwnerB) {
    newStatus = 'connected'
  }

  if (!newStatus) {
    return NextResponse.json({ error: 'Invalid state transition' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('wish_connections')
    .update({ status: newStatus })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ status: updated.status, connection_id: updated.id })
}
