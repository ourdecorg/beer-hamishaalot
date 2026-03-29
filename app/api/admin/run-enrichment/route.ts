import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prepareWishForMatching } from '@/lib/matching'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // All open, non-cancelled wishes
  const { data: allWishes } = await admin
    .from('wishes')
    .select('id, original_text')
    .eq('visibility', 'open')
    .neq('status', 'cancelled')

  const wishes = allWishes ?? []
  const allIds = wishes.map((w: { id: string }) => w.id)

  if (allIds.length === 0) {
    return NextResponse.json({ message: 'No public wishes found', started: 0, missing: 0 })
  }

  // IDs that already have enrichment
  const { data: enriched } = await admin
    .from('wish_enrichment')
    .select('wish_id')
    .in('wish_id', allIds)
  const enrichedSet = new Set((enriched ?? []).map((r: { wish_id: string }) => r.wish_id))

  // IDs that already have embeddings
  const { data: embedded } = await admin
    .from('wish_embeddings')
    .select('wish_id')
    .in('wish_id', allIds)
  const embeddedSet = new Set((embedded ?? []).map((r: { wish_id: string }) => r.wish_id))

  // Keep only wishes missing enrichment OR embedding
  const toProcess = wishes.filter(
    (w: { id: string }) => !enrichedSet.has(w.id) || !embeddedSet.has(w.id)
  )

  if (toProcess.length === 0) {
    return NextResponse.json({ message: 'All wishes already have enrichment and embeddings', started: 0, missing: 0 })
  }

  const STAGGER_MS = 1000

  const promises: Promise<void>[] = []
  for (let i = 0; i < toProcess.length; i++) {
    const w = toProcess[i]
    promises.push(
      new Promise<void>(resolve => setTimeout(resolve, i * STAGGER_MS))
        .then(() => prepareWishForMatching(w.id, w.original_text))
    )
  }
  await Promise.all(promises)

  return NextResponse.json({
    message: `Enrichment + embedding complete for ${toProcess.length} wishes.`,
    started: toProcess.length,
    missing: toProcess.length,
  })
}
