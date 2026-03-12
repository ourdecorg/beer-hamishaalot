import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichWish } from '@/lib/claude'

interface Params {
  params: { id: string }
}

// Manually trigger (or re-trigger) AI enrichment for a wish
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: wish } = await supabase
    .from('wishes')
    .select('id, original_text, user_id')
    .eq('id', params.id)
    .single()

  if (!wish) {
    return NextResponse.json({ error: 'Wish not found' }, { status: 404 })
  }

  if (wish.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const enrichment = await enrichWish(wish.original_text)

    const { data: updated, error } = await supabase
      .from('wishes')
      .update({
        ai_summary: enrichment.ai_summary,
        ai_tags: enrichment.ai_tags,
        intention_statement: enrichment.intention_statement,
        is_ai_enriched: true,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update wish' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Enrichment error:', err)
    return NextResponse.json({ error: 'AI enrichment failed' }, { status: 500 })
  }
}
