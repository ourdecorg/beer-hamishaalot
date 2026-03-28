import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReviewMatchesClient, {
  type AttemptRow,
  type WishStub,
  type ExistingReview,
} from '@/components/admin/ReviewMatchesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'פידבק התאמות — ניהול' }

export default async function ReviewMatchesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  // Auth guard
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/')

  const sp = searchParams
  const typeFilter     = typeof sp.type     === 'string' ? sp.type     : 'all'
  const reviewedFilter = typeof sp.reviewed === 'string' ? sp.reviewed : 'all'
  const gateFilter     = typeof sp.gate     === 'string' ? sp.gate     : 'all'
  const nearFilter     = typeof sp.near     === 'string' ? sp.near     : '0'

  const admin = createAdminClient()

  // ── 1. Fetch match_attempts_log with filters ──────────────────────────────
  let query = admin
    .from('match_attempts_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60)

  if (typeFilter === 'passed')   query = query.eq('passed_threshold', true)
  if (typeFilter === 'rejected') query = query.eq('passed_threshold', false)
  if (gateFilter === 'failed')   query = query.eq('gate_passed', false)
  if (nearFilter === '1')        query = query.gte('match_score', 0.40).lte('match_score', 0.55)

  const { data: rawAttempts } = await query
  let attempts = (rawAttempts ?? []) as AttemptRow[]

  // ── 2. Batch fetch wish stubs ─────────────────────────────────────────────
  const wishIds = [...new Set([
    ...attempts.map(a => a.wish_id),
    ...attempts.map(a => a.candidate_wish_id),
  ])]

  const { data: wishRows } = wishIds.length > 0
    ? await admin.from('wishes').select('id, original_text, contact_city').in('id', wishIds)
    : { data: [] }

  const wishMap: Record<string, WishStub> = {}
  for (const w of wishRows ?? []) wishMap[w.id] = w as WishStub

  // ── 3. Fetch connections for these wishes ─────────────────────────────────
  const { data: connRows } = wishIds.length > 0
    ? await admin
        .from('wish_connections')
        .select('id, wish_a, wish_b')
        .or(`wish_a.in.(${wishIds.join(',')}),wish_b.in.(${wishIds.join(',')})`)
    : { data: [] }

  // canonical "min:max" → connection_id
  const connectionMap: Record<string, string | null> = {}
  for (const c of connRows ?? []) {
    const key = c.wish_a < c.wish_b ? `${c.wish_a}:${c.wish_b}` : `${c.wish_b}:${c.wish_a}`
    connectionMap[key] = c.id
  }

  // ── 4. Fetch existing reviews by this admin ───────────────────────────────
  const { data: reviewRows } = wishIds.length > 0
    ? await admin
        .from('match_reviews')
        .select('wish_id, candidate_wish_id, connection_id, label, note')
        .eq('reviewer_email', user.email!)
        .in('wish_id', attempts.map(a => a.wish_id))
    : { data: [] }

  const reviewMap: Record<string, ExistingReview> = {}
  for (const r of reviewRows ?? []) {
    reviewMap[`${r.wish_id}:${r.candidate_wish_id}`] = r as ExistingReview
  }

  // ── 5. Apply reviewed filter (client-side after review fetch) ─────────────
  if (reviewedFilter === 'yes') {
    attempts = attempts.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  } else if (reviewedFilter === 'no') {
    attempts = attempts.filter(a => !reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  }

  return (
    <ReviewMatchesClient
      attempts={attempts}
      wishMap={wishMap}
      connectionMap={connectionMap}
      reviewMap={reviewMap}
      userEmail={user.email!}
      filters={{ type: typeFilter, reviewed: reviewedFilter, gate: gateFilter, near: nearFilter }}
    />
  )
}
