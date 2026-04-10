/**
 * GET /api/wishes/[id]/matches
 *
 * Returns published match opportunities for a wish.
 * Only the wish owner (or admin) can call this.
 *
 * Identity reveal policy:
 *   - Before mutual acceptance: no personal details from either side.
 *   - After mutual acceptance (mutual_accepted_at IS NOT NULL):
 *     the other side's shared_profile_snapshot is returned.
 *   - The current user's own response + the other side's response status
 *     are always returned so the UI can render the correct CTA.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  MatchResult,
  WishEnrichment,
  ConnectionResponse,
  ConnectionStatus,
  DisclosureState,
  MatchType,
} from '@/lib/types'

interface Params {
  params: { id: string }
}

function deriveDisclosureState(
  myResponse: ConnectionResponse,
  otherResponse: ConnectionResponse,
  mutualAcceptedAt: string | null
): DisclosureState {
  if (mutualAcceptedAt) return 'mutual_accept'
  if (myResponse === 'declined' || otherResponse === 'declined') return 'declined'
  if (myResponse === 'accepted' || otherResponse === 'accepted') return 'one_side_accepted'
  return 'pending'
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = user.email === process.env.ADMIN_EMAIL

  // Verify ownership (admin can access any wish)
  const { data: wish } = await supabase
    .from('wishes')
    .select('id, user_id')
    .eq('id', params.id)
    .single()

  if (!wish || (!isAdmin && wish.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Admin bypasses RLS — use service-role client for all data queries
  const db = isAdmin ? createAdminClient() : supabase

  // Fetch connections where this wish is either side — include disclosure columns.
  // Using '*' because the disclosure columns (migration 042) are not in generated Supabase types;
  // we cast to WishConnectionRow below.
  const { data: rawConnections, error } = await db
    .from('wish_connections')
    .select('*')
    .or(`wish_a.eq.${params.id},wish_b.eq.${params.id}`)
    .neq('status', 'deleted')
    .eq('published', true)
    .order('match_score', { ascending: false })

  // Cast to a local interface that includes the new disclosure columns
  type WishConnectionRow = {
    id: string
    wish_a: string
    wish_b: string
    match_score: number
    match_type: string
    status: string
    explanation: unknown
    published: boolean
    user_a_response: string | null
    user_a_shared_fields_json: string[] | null
    user_a_shared_profile_snapshot_json: unknown
    user_a_intro_message: string | null
    user_b_response: string | null
    user_b_shared_fields_json: string[] | null
    user_b_shared_profile_snapshot_json: unknown
    user_b_intro_message: string | null
    mutual_accepted_at: string | null
  }
  const connections = rawConnections as WishConnectionRow[] | null

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json([])
  }

  // Collect matched wish IDs
  const matchedWishIds = connections.map((c) =>
    c.wish_a === params.id ? c.wish_b : c.wish_a
  )

  // Fetch enrichments + own themes + matched wish texts + connection enrichment in parallel
  const [enrichmentsRes, ownEnrichmentRes, matchedWishesRes, connEnrichRes] = await Promise.all([
    db.from('wish_enrichment').select('*').in('wish_id', matchedWishIds),
    db.from('wish_enrichment').select('themes').eq('wish_id', params.id).maybeSingle(),
    db.from('wishes').select('id, original_text').in('id', matchedWishIds),
    createAdminClient()
      .from('connection_enrichment')
      .select(
        'wish_a_id, wish_b_id, overall_connection_score, opportunity_for_wish_a, opportunity_for_wish_b, shared_basis'
      )
      .or(`wish_a_id.eq.${params.id},wish_b_id.eq.${params.id}`),
  ])

  const { data: enrichments } = enrichmentsRes
  const { data: ownEnrichment } = ownEnrichmentRes
  const { data: matchedWishes } = matchedWishesRes

  const enrichmentMap = new Map<string, WishEnrichment>(
    (enrichments ?? []).map((e) => [e.wish_id, e as WishEnrichment])
  )

  const ownThemes = new Set<string>(
    (ownEnrichment?.themes ?? []).map((t: string) => t.toLowerCase().trim())
  )

  const matchedWishMap = new Map(
    (matchedWishes ?? []).map((w) => [w.id, w.original_text])
  )

  // Build connection_enrichment map keyed by matched wish ID
  type ConnEnrich = {
    overall_connection_score: number
    opportunity_for_wish_a: { he: string; en: string } | null
    opportunity_for_wish_b: { he: string; en: string } | null
    shared_basis: { he: string; en: string } | null
    wish_a_id: string
    wish_b_id: string
  }
  const connEnrichMap = new Map<string, ConnEnrich>()
  for (const ce of connEnrichRes.data ?? []) {
    const matchedId = ce.wish_a_id === params.id ? ce.wish_b_id : ce.wish_a_id
    connEnrichMap.set(matchedId, ce as ConnEnrich)
  }

  const matchSummaryMap: Record<string, string> = {
    strong: 'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה',
    complementary: 'משלים — אחד מציע מה שהשני צריך',
    similar: 'דומה — שאיפות וערכים משותפים',
    RESONANT: 'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה',
    COMPLEMENTARY: 'משלים — אחד מציע מה שהשני צריך',
    SIMILAR: 'דומה — שאיפות וערכים משותפים',
  }

  // Build MatchResult array
  const results: MatchResult[] = connections.map((conn) => {
    const isWishA = conn.wish_a === params.id
    const matchedWishId = isWishA ? conn.wish_b : conn.wish_a

    const enrichment = enrichmentMap.get(matchedWishId)
    const matchedThemes: string[] = enrichment?.themes ?? []
    const sharedThemes = matchedThemes.filter((t) =>
      ownThemes.has(t.toLowerCase().trim())
    )

    const ce = connEnrichMap.get(matchedWishId)

    // ── Disclosure ────────────────────────────────────────────────────────────
    const myResponse = (
      isWishA ? conn.user_a_response : conn.user_b_response
    ) as ConnectionResponse ?? 'pending'
    const otherResponse = (
      isWishA ? conn.user_b_response : conn.user_a_response
    ) as ConnectionResponse ?? 'pending'
    const mutualAcceptedAt: string | null = conn.mutual_accepted_at ?? null

    const disclosureState = deriveDisclosureState(myResponse, otherResponse, mutualAcceptedAt)

    // Only reveal the other side's snapshot when mutually accepted
    const otherSnapshot =
      disclosureState === 'mutual_accept'
        ? ((isWishA
            ? conn.user_b_shared_profile_snapshot_json
            : conn.user_a_shared_profile_snapshot_json) as Record<
            string,
            string | null
          > | null) ?? null
        : null

    const otherIntroMessage =
      disclosureState === 'mutual_accept'
        ? ((isWishA ? conn.user_b_intro_message : conn.user_a_intro_message) as string | null) ??
          null
        : null

    const explanation = (conn.explanation as { short_reason?: string } | null)

    const result: MatchResult = {
      connection_id: conn.id,
      matched_wish_id: matchedWishId,
      match_score: conn.match_score,
      match_type: conn.match_type as MatchType,
      status: conn.status as ConnectionStatus,
      shared_themes: sharedThemes,
      match_summary: matchSummaryMap[conn.match_type] ?? 'התאמה',
      matched_wish_text: matchedWishMap.get(matchedWishId) ?? undefined,
      explanation_text: explanation?.short_reason ?? undefined,
      overall_connection_score: ce?.overall_connection_score ?? null,
      opportunity: ce
        ? isWishA
          ? ce.opportunity_for_wish_a
          : ce.opportunity_for_wish_b
        : null,
      shared_basis: ce?.shared_basis ?? null,

      // Disclosure
      my_response: myResponse,
      other_response: otherResponse,
      disclosure_state: disclosureState,
      other_shared_snapshot: otherSnapshot,
      other_intro_message: otherIntroMessage,
      my_shared_fields: (isWishA ? conn.user_a_shared_fields_json : conn.user_b_shared_fields_json) ?? null,
      my_intro_message: (isWishA ? conn.user_a_intro_message : conn.user_b_intro_message) ?? null,
    }

    // Admin view: also include wish-level contact data (not gated by disclosure)
    if (isAdmin) {
      result.contact = { name: null, email: null, phone: null }
    }

    return result
  })

  return NextResponse.json(results)
}
