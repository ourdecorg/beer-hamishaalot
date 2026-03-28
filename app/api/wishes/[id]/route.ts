import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: wish, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !wish) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(wish)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const allowedFields = ['original_text', 'visibility']
  const updates: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }

  const { data: wish, error } = await supabase
    .from('wishes')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id) // RLS: only owner
    .select()
    .single()

  if (error || !wish) {
    return NextResponse.json({ error: 'Update failed or not found' }, { status: 404 })
  }

  return NextResponse.json(wish)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership with user client, then update with admin to bypass RLS
  const { data: wish } = await supabase
    .from('wishes')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!wish) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('wishes')
    .update({ status: 'cancelled' })
    .eq('id', params.id)

  if (error) {
    console.error('Soft delete error:', error)
    return NextResponse.json({ error: 'Delete failed', detail: error.message }, { status: 500 })
  }

  // Mark all connections involving this wish as deleted
  await admin
    .from('wish_connections')
    .update({ status: 'deleted' })
    .or(`wish_a.eq.${params.id},wish_b.eq.${params.id}`)

  return NextResponse.json({ success: true })
}
