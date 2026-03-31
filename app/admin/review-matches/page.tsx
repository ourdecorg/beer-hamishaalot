import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReviewMatchesClient, {
  type AttemptRow,
  type WishStub,
  type WishEnrichmentStub,
  type ExistingReview,
} from '@/components/admin/ReviewMatchesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'פידבק התאמות — ניהול' }

const PAGE_SIZE = 60

const SORT_COLUMNS: Record<string, string> = {
  match_score:     'match_score',
  semantic_en:     'semantic_similarity',
  complementarity: 'complementarity_score',
  structural:      'structural_similarity',
  geo:             'geo_penalty',
}

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
  const typeFilter      = typeof sp.type      === 'string' ? sp.type      : 'all'
  const reviewedFilter  = typeof sp.reviewed  === 'string' ? sp.reviewed  : 'all'
  const gateFilter      = typeof sp.gate      === 'string' ? sp.gate      : 'all'
  const nearFilter      = typeof sp.near      === 'string' ? sp.near      : '0'
  const cancelledFilter = typeof sp.cancelled === 'string' ? sp.cancelled : 'hide'
  const sortKey         = typeof sp.sort      === 'string' && SORT_COLUMNS[sp.sort] ? sp.sort : 'match_score'
  const page            = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1') || 1)
  const searchFilter    = typeof sp.search    === 'string' ? sp.search.trim() : ''

  const admin = createAdminClient()

  // ── 1. Fetch match_attempts_log with filters + sort + pagination ──────────
  const col = SORT_COLUMNS[sortKey]
  const from = (page - 1) * PAGE_SIZE
  const to   = page * PAGE_SIZE - 1

  // If searching, find wish IDs matching the text first
  let searchWishIds: string[] | null = null
  if (searchFilter) {
    const { data: matchingWishes } = await admin
      .from('wishes')
      .select('id')
      .ilike('original_text', `%${searchFilter}%`)
    searchWishIds = (matchingWishes ?? []).map((w: { id: string }) => w.id)
    if (searchWishIds.length === 0) searchWishIds = ['00000000-0000-0000-0000-000000000000'] // no results
  }

  let query = admin
    .from('match_attempts_log')
    .select('*', { count: 'exact' })
    .order(col, { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (typeFilter === 'passed')   query = query.eq('passed_threshold', true)
  if (typeFilter === 'rejected') query = query.eq('passed_threshold', false)
  if (gateFilter === 'failed')   query = query.eq('gate_passed', false)
  if (nearFilter === '1')        query = query.gte('match_score', 0.40).lte('match_score', 0.55)
  if (searchWishIds)             query = query.or(`wish_id.in.(${searchWishIds.join(',')}),candidate_wish_id.in.(${searchWishIds.join(',')})`)

  const { data: rawAttempts, count } = await query
  let attempts = (rawAttempts ?? []) as AttemptRow[]
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // ── 2. Batch fetch wish stubs ─────────────────────────────────────────────
  const wishIds = [...new Set([
    ...attempts.map(a => a.wish_id),
    ...attempts.map(a => a.candidate_wish_id),
  ])]

  const { data: wishRows } = wishIds.length > 0
    ? await admin.from('wishes').select('id, original_text, contact_city, status').in('id', wishIds)
    : { data: [] }

  const wishMap: Record<string, WishStub> = {}
  for (const w of wishRows ?? []) wishMap[w.id] = w as WishStub

  // ── 3. Fetch enrichment stubs (needs + skills_offered) ───────────────────
  const { data: enrichmentRows } = wishIds.length > 0
    ? await admin.from('wish_enrichment').select('wish_id, needs, skills_offered').in('wish_id', wishIds)
    : { data: [] }

  const enrichmentMap: Record<string, WishEnrichmentStub> = {}
  for (const e of enrichmentRows ?? []) enrichmentMap[e.wish_id] = e as WishEnrichmentStub

  // ── 4. Fetch connections ──────────────────────────────────────────────────
  const { data: connRows } = wishIds.length > 0
    ? await admin
        .from('wish_connections')
        .select('id, wish_a, wish_b')
        .or(`wish_a.in.(${wishIds.join(',')}),wish_b.in.(${wishIds.join(',')})`)
    : { data: [] }

  const connectionMap: Record<string, string | null> = {}
  for (const c of connRows ?? []) {
    const key = c.wish_a < c.wish_b ? `${c.wish_a}:${c.wish_b}` : `${c.wish_b}:${c.wish_a}`
    connectionMap[key] = c.id
  }

  // ── 5. Fetch existing reviews ─────────────────────────────────────────────
  const { data: reviewRows } = attempts.length > 0
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

  // ── 6. Apply cancelled filter ─────────────────────────────────────────────
  if (cancelledFilter !== 'show') {
    attempts = attempts.filter(a =>
      wishMap[a.wish_id]?.status !== 'cancelled' &&
      wishMap[a.candidate_wish_id]?.status !== 'cancelled'
    )
  }

  // ── 7. Apply reviewed filter ──────────────────────────────────────────────
  if (reviewedFilter === 'yes') {
    attempts = attempts.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  } else if (reviewedFilter === 'no') {
    attempts = attempts.filter(a => !reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  }

  return (
    <ReviewMatchesClient
      attempts={attempts}
      wishMap={wishMap}
      enrichmentMap={enrichmentMap}
      connectionMap={connectionMap}
      reviewMap={reviewMap}
      userEmail={user.email!}
      filters={{ type: typeFilter, reviewed: reviewedFilter, gate: gateFilter, near: nearFilter, cancelled: cancelledFilter }}
      sort={sortKey}
      search={searchFilter}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
}
