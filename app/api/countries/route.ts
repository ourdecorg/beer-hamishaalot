/**
 * GET /api/countries
 *
 * Returns all countries ordered by name, with Israel first.
 * Public endpoint — no auth required (reference data).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Must be dynamic — table is populated after deploy, cannot be statically cached
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('countries')
    .select('id, alpha2, name')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 })
  }

  // Israel first, then alphabetical
  const sorted = [
    ...(data ?? []).filter((c: { name: string }) => c.name === 'Israel'),
    ...(data ?? []).filter((c: { name: string }) => c.name !== 'Israel'),
  ]

  return NextResponse.json(sorted)
}
