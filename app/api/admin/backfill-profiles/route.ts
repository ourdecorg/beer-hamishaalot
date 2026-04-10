import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== process.env.ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Collect IDs that already have a profile row
  const { data: existing, error: existingError } = await admin
    .from('user_profiles')
    .select('id')
  if (existingError)
    return NextResponse.json({ error: existingError.message }, { status: 500 })

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id))

  // Paginate through auth.users and collect rows to insert
  const toInsert: {
    id: string
    display_name: string | null
    email: string | null
    phone: null
    country: null
    city: null
    updated_at: string
  }[] = []

  let page = 1
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (!data?.users?.length) break
    for (const u of data.users) {
      if (existingIds.has(u.id)) continue
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>
      const display_name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        null
      toInsert.push({
        id: u.id,
        display_name,
        email: u.email ?? null,
        phone: null,
        country: null,
        city: null,
        updated_at: new Date().toISOString(),
      })
    }
    if (data.users.length < 1000) break
    page++
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await admin.from('user_profiles').insert(toInsert)
    if (insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ created: toInsert.length })
}
