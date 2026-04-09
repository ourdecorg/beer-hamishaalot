/**
 * GET  /api/profile  — fetch the authenticated user's profile
 * PATCH /api/profile  — update the authenticated user's profile fields
 *
 * The user_profiles table stores identity/contact fields separately from
 * wishes. Fields are NEVER automatically shared — disclosure happens
 * per-connection when a user explicitly accepts (see /api/connections/[id]/respond).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/types'

const SHAREABLE_FIELDS = [
  'display_name',
  'email',
  'phone',
  'country',
  'city',
] as const

const EMPTY_PROFILE: Omit<UserProfile, 'id' | 'updated_at'> = {
  display_name: null,
  email: null,
  phone: null,
  country: null,
  city: null,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Return empty profile shape if the row doesn't exist yet.
  // Seed display_name from auth metadata (Google full_name / name) as a default.
  if (!profile) {
    const meta = user.user_metadata ?? {}
    const authName: string | null =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      null
    return NextResponse.json({
      id: user.id,
      updated_at: null,
      ...EMPTY_PROFILE,
      display_name: authName,
    })
  }
  return NextResponse.json(profile)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  // Only allow whitelisted fields — no other columns can be set
  const updates: Record<string, string | null> = {}
  for (const field of SHAREABLE_FIELDS) {
    if (field in body) {
      const v = body[field]
      updates[field] = typeof v === 'string' ? v.trim() || null : null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ id: user.id, ...updates }, { onConflict: 'id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json(data)
}
