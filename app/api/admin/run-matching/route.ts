import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWishForMatching } from '@/lib/matching'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { wishIds?: string[] }
  const admin = createAdminClient()

  let wishIds: string[] = body.wishIds ?? []

  // If no IDs provided, run for ALL public wishes
  if (wishIds.length === 0) {
    const { data: wishes } = await admin
      .from('wishes')
      .select('id')
      .eq('visibility', 'open')
      .neq('status', 'cancelled')
    wishIds = (wishes ?? []).map((w: { id: string }) => w.id)
  }

  if (wishIds.length === 0) {
    return NextResponse.json({ message: 'No public wishes found', started: 0 })
  }

  // Fetch wish texts for all IDs
  const { data: wishes } = await admin
    .from('wishes')
    .select('id, original_text')
    .in('id', wishIds)

  const wishMap = new Map((wishes ?? []).map((w: { id: string; original_text: string }) => [w.id, w.original_text]))

  // Stagger wish processing to avoid OpenAI TPM rate limits.
  // Each wish starts 3 seconds after the previous one — the response is
  // returned immediately; Railway keeps the process alive so all complete.
  const STAGGER_MS = 1000
  let started = 0
  for (let i = 0; i < wishIds.length; i++) {
    const id = wishIds[i]
    const text = wishMap.get(id)
    if (!text) continue
    setTimeout(() => processWishForMatching(id, text, { onlyLowerId: true }), i * STAGGER_MS)
    started++
  }

  return NextResponse.json({
    message: `Matching pipeline started for ${started} wishes. Results will appear in wish_connections as each completes.`,
    started,
  })
}
