import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Admin guard
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })

  // Decode Windows-1255 (standard encoding for CBS yishuvim CSV)
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('windows-1255').decode(buffer)

  // Parse CSV — columns: id, name_he, name_en, district_code, district, office_code, office, council_code, council
  const rows = text
    .split('\n')
    .map(l => l.split(',').map(c => c.trim()))
    .filter(cols => cols.length >= 5)

  const data = rows
    .slice(1) // skip header row
    .map(cols => ({
      id:       parseInt(cols[0]),
      name:     cols[1],
      name_en:  cols[2] || null,
      district: cols[4] || null,
      council:  cols[8] || null,
    }))
    .filter(r => r.id > 0 && r.name) // skip "לא רשום" (id=0) and empty rows

  if (data.length === 0) {
    return NextResponse.json({ error: 'לא נמצאו שורות תקינות בקובץ' }, { status: 400 })
  }

  // Upsert in batches of 100
  const admin = createAdminClient()
  const BATCH = 100

  for (let i = 0; i < data.length; i += BATCH) {
    const { error } = await admin
      .from('settlements')
      .upsert(data.slice(i, i + BATCH), { onConflict: 'id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: data.length })
}
