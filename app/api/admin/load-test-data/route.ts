import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

interface CsvRow {
  name: string
  city: string
  region: string
  phone: string
  email: string
  wishText: string
}

function parseCsv(text: string): CsvRow[] {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/)
  if (lines.length < 2) return []

  // Skip header row (index 0)
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCsvLine(line)
    if (cols.length < 7) continue
    rows.push({
      name:     cols[0].trim(),
      city:     cols[1].trim(),
      region:   cols[2].trim(),
      // cols[3] = house number (ignored)
      phone:    cols[4].trim(),
      email:    cols[5].trim(),
      wishText: cols[6].trim(),
    })
  }
  return rows
}

/** Split a CSV line respecting double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      cols.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur)
  return cols
}

export async function POST(request: NextRequest) {
  // Auth guard — must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin guard (optional) — set ADMIN_EMAIL in env to restrict access
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length === 0) return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })

  const admin = createAdminClient()
  const created: { wishId: string; wishText: string; email: string }[] = []
  const errors: { email: string; error: string }[] = []

  for (const row of rows) {
    if (!row.email || !row.wishText) continue

    try {
      // Find or create auth user
      let userId: string
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const existing = existingUsers?.users.find(u => u.email === row.email)

      if (existing) {
        userId = existing.id
      } else {
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email: row.email,
          password: Math.random().toString(36).slice(-10) + 'A1!',
          email_confirm: true,
          user_metadata: { full_name: row.name },
        })
        if (createErr || !newUser.user) {
          errors.push({ email: row.email, error: createErr?.message ?? 'Failed to create user' })
          continue
        }
        userId = newUser.user.id
      }

      // Insert wish
      const { data: wish, error: wishErr } = await admin
        .from('wishes')
        .insert({
          user_id:       userId,
          user_email:    row.email,
          original_text: row.wishText,
          visibility:    'open',
          is_ai_enriched: false,
          contact_name:  row.name,
          contact_city:  row.city,
          contact_phone: row.phone,
          contact_email: row.email,
        })
        .select('id')
        .single()

      if (wishErr || !wish) {
        errors.push({ email: row.email, error: wishErr?.message ?? 'Failed to insert wish' })
        continue
      }

      created.push({ wishId: wish.id, wishText: row.wishText, email: row.email })
    } catch (err: unknown) {
      errors.push({ email: row.email, error: String(err) })
    }
  }

  return NextResponse.json({
    created: created.length,
    errors:  errors.length,
    wishIds: created.map(c => c.wishId),
    details: errors.length > 0 ? errors : undefined,
  })
}
