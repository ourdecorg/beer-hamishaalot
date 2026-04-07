import { NextResponse, type NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { processWishForMatching } from '@/lib/matching'
import type { CreateWishInput } from '@/lib/types'

// Allow enough time for the matching pipeline (GPT-4o analysis + embedding + scoring)
export const maxDuration = 60

const REQUIRED_CONTACT_FIELDS = ['contact_name'] as const

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

  const { original_text, visibility, contact, consent_to_match_sharing } = body

  if (!original_text?.trim()) {
    return NextResponse.json({ error: 'original_text is required' }, { status: 400 })
  }
  if (original_text.length > 1000) {
    return NextResponse.json({ error: 'Wish text is too long (max 1000 chars)' }, { status: 400 })
  }
  if (visibility !== 'open') {
    return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 })
  }
  if (!consent_to_match_sharing) {
    return NextResponse.json({ error: 'Consent to match sharing is required' }, { status: 400 })
  }

  // Validate contact info
  for (const field of REQUIRED_CONTACT_FIELDS) {
    if (!contact?.[field]?.trim()) {
      return NextResponse.json({ error: `שדה ${field} הוא חובה` }, { status: 400 })
    }
  }

  // 1. Insert the wish — content only, no identity fields
  const { data: wish, error: insertError } = await supabase
    .from('wishes')
    .insert({
      user_id: user.id,
      original_text: original_text.trim(),
      visibility,
      consent_to_match_sharing: true,
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

  // 2. Upsert user profile with the contact details, then run matching (both fire-and-forget)
  waitUntil(
    (async () => {
      await supabase.from('user_profiles').upsert(
        {
          id: user.id,
          display_name: contact?.contact_name?.trim() || null,
          city: contact?.contact_city?.trim() || null,
          address: contact?.contact_address?.trim() || null,
          phone: contact?.contact_phone?.trim() || null,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      await processWishForMatching(wish.id, original_text.trim())
    })()
  )

  return NextResponse.json(wish, { status: 201 })
}

export async function GET(_request: NextRequest) {
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
