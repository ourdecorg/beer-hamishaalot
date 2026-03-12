import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: wish, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !wish) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Private wishes only visible to owner
  if (wish.visibility === 'private' && wish.user_id !== user?.id) {
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

  const { error } = await supabase
    .from('wishes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
