import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  return user && adminEmail && user.email === adminEmail ? user : null
}

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const user = await checkAdmin(authClient)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    wish_id: string
    candidate_wish_id: string
    connection_id?: string | null
    label: 'good' | 'maybe' | 'bad'
    note?: string
  }

  if (!body.wish_id || !body.candidate_wish_id || !['good', 'maybe', 'bad'].includes(body.label)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('match_reviews').upsert(
    {
      wish_id:           body.wish_id,
      candidate_wish_id: body.candidate_wish_id,
      connection_id:     body.connection_id ?? null,
      reviewer_email:    user.email!,
      label:             body.label,
      note:              body.note?.trim() || null,
    },
    { onConflict: 'wish_id,candidate_wish_id,reviewer_email' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
