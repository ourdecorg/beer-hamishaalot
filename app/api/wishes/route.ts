import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichWish } from '@/lib/claude'
import { processWishForMatching } from '@/lib/matching'
import type { CreateWishInput } from '@/lib/types'

const REQUIRED_CONTACT_FIELDS = ['contact_name', 'contact_country', 'contact_city'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateWishInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { original_text, visibility, contact } = body

  if (!original_text?.trim()) {
    return NextResponse.json({ error: 'original_text is required' }, { status: 400 })
  }
  if (original_text.length > 1000) {
    return NextResponse.json({ error: 'Wish text is too long (max 1000 chars)' }, { status: 400 })
  }
  if (!['private', 'anonymous', 'open'].includes(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 })
  }

  // Validate contact info for open wishes
  if (visibility === 'open') {
    for (const field of REQUIRED_CONTACT_FIELDS) {
      if (!contact?.[field]?.trim()) {
        return NextResponse.json({ error: `שדה ${field} הוא חובה עבור משאלה פתוחה` }, { status: 400 })
      }
    }
  }

  // 1. Insert the wish first (so user has something immediately)
  const { data: wish, error: insertError } = await supabase
    .from('wishes')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      original_text: original_text.trim(),
      visibility,
      is_ai_enriched: false,
      ...(visibility === 'open' && contact ? {
        contact_name: contact.contact_name?.trim() || null,
        contact_country: contact.contact_country?.trim() || null,
        contact_city: contact.contact_city?.trim() || null,
        contact_address: contact.contact_address?.trim() || null,
        contact_phone: contact.contact_phone?.trim() || null,
      } : {}),
    })
    .select()
    .single()

  if (insertError || !wish) {
    console.error('Insert error:', insertError)
    return NextResponse.json(
      { error: 'Failed to save wish', detail: insertError?.message, code: insertError?.code },
      { status: 500 }
    )
  }

  // 2. Enrich with Claude (fire-and-forget or awaited)
  // We await it here so the wish page immediately shows enrichment
  try {
    const enrichment = await enrichWish(original_text.trim())

    await supabase
      .from('wishes')
      .update({
        ai_summary: enrichment.ai_summary,
        ai_tags: enrichment.ai_tags,
        intention_statement: enrichment.intention_statement,
        is_ai_enriched: true,
      })
      .eq('id', wish.id)

    // 3. Fire-and-forget: deep analysis + embedding + matching (non-blocking)
    // Only runs for visible wishes — private wishes are never matched
    if (['anonymous', 'open'].includes(visibility)) {
      processWishForMatching(wish.id, original_text.trim())
    }

    return NextResponse.json({ ...wish, ...enrichment, is_ai_enriched: true }, { status: 201 })
  } catch (err) {
    console.error('Claude enrichment error:', err)
    // Return the wish even if enrichment failed — non-blocking
    // Still try to run matching even if basic enrichment failed
    if (['anonymous', 'open'].includes(visibility)) {
      processWishForMatching(wish.id, original_text.trim())
    }
    return NextResponse.json(wish, { status: 201 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: wishes, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch wishes' }, { status: 500 })
  }

  return NextResponse.json(wishes)
}
