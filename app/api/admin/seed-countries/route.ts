/**
 * POST /api/admin/seed-countries
 *
 * Loads the ISO 3166-1 countries CSV into the countries table.
 * CSV format (UTF-8): id,alpha2,alpha3,name
 * Admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })

  // CSV is UTF-8
  const text = await file.text()

  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const data = rows
    .slice(1) // skip header: id,alpha2,alpha3,name
    .map((line) => {
      // Handle quoted fields (e.g. "Bolivia, Plurinational State of")
      const cols: string[] = []
      let cur = ''
      let inQuote = false
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote }
        else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      cols.push(cur.trim())
      return cols
    })
    .map((cols) => ({
      id:     parseInt(cols[0]),
      alpha2: cols[1],
      alpha3: cols[2],
      name:   cols[3],
    }))
    .filter((r) => r.id > 0 && r.name && r.alpha2)

  if (data.length === 0) {
    return NextResponse.json({ error: 'לא נמצאו שורות תקינות בקובץ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const BATCH = 100

  for (let i = 0; i < data.length; i += BATCH) {
    const { error } = await admin
      .from('countries')
      .upsert(data.slice(i, i + BATCH), { onConflict: 'id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: data.length })
}
