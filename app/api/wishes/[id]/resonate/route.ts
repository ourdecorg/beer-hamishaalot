import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: { id: string }
}

// Toggle resonance — POST to add, DELETE to remove
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify wish exists and is resonatable
  const { data: wish } = await supabase
    .from('wishes')
    .select('id, visibility, user_id')
    .eq('id', params.id)
    .single()

  if (!wish || !['anonymous', 'open'].includes(wish.visibility)) {
    return NextResponse.json({ error: 'Wish not found or not resonatable' }, { status: 404 })
  }

  if (wish.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot resonate with your own wish' }, { status: 400 })
  }

  const { error } = await supabase
    .from('wish_resonances')
    .insert({ wish_id: params.id, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      // Already resonated — idempotent
      return NextResponse.json({ resonated: true })
    }
    return NextResponse.json({ error: 'Failed to resonate' }, { status: 500 })
  }

  return NextResponse.json({ resonated: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('wish_resonances')
    .delete()
    .eq('wish_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to remove resonance' }, { status: 500 })
  }

  return NextResponse.json({ resonated: false })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count } = await supabase
    .from('wish_resonances')
    .select('*', { count: 'exact', head: true })
    .eq('wish_id', params.id)

  let userHasResonated = false
  if (user) {
    const { data } = await supabase
      .from('wish_resonances')
      .select('id')
      .eq('wish_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userHasResonated = !!data
  }

  return NextResponse.json({ count: count ?? 0, user_has_resonated: userHasResonated })
}
