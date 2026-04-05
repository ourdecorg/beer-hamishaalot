/**
 * GET /api/wishes/[id]/matches
 *
 * Returns the top resonance matches for a wish.
 * Only the wish owner can see their matches.
 * Identities are hidden until status === 'connected'.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MatchResult, WishEnrichment } from '@/lib/types'

interface Params {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership
  const { data: wish } = await supabase
    .from('wishes')
    .select('id, user_id')
    .eq('id', params.id)
    .single()

  if (!wish || wish.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch connections where this wish is either side
  const { data: connections, error } = await supabase
    .from('wish_connections')
    .select('*')
    .or(`wish_a.eq.${params.id},wish_b.eq.${params.id}`)
    .neq('status', 'deleted')
    .eq('published', true)
    .order('match_score', { ascending: false })

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

  // Fetch enrichments for matched wishes + own themes + contact info + connection enrichment in parallel
  const [enrichmentsRes, ownEnrichmentRes, contactWishesRes, connEnrichRes] = await Promise.all([
    supabase.from('wish_enrichment').select('*').in('wish_id', matchedWishIds),
    supabase.from('wish_enrichment').select('themes').eq('wish_id', params.id).maybeSingle(),
    supabase
      .from('wishes')
      .select('id, original_text, contact_name, contact_email, contact_phone')
      .in('id', matchedWishIds),
    supabase
      .from('connection_enrichment')
      .select('wish_a_id, wish_b_id, overall_connection_score, opportunity_for_wish_a, opportunity_for_wish_b, shared_basis')
      .or(`wish_a_id.eq.${params.id},wish_b_id.eq.${params.id}`),
  ])

  const { data: enrichments } = enrichmentsRes
  const { data: ownEnrichment } = ownEnrichmentRes
  const { data: contactWishes } = contactWishesRes

  const enrichmentMap = new Map<string, WishEnrichment>(
    (enrichments ?? []).map((e) => [e.wish_id, e as WishEnrichment])
  )

  const ownThemes = new Set<string>(
    (ownEnrichment?.themes ?? []).map((t: string) => t.toLowerCase().trim())
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

  const contactMap = new Map(
    (contactWishes ?? []).map((w) => [
      w.id,
      { name: w.contact_name, email: w.contact_email, phone: w.contact_phone, original_text: w.original_text },
    ])
  )

  // Build MatchResult array
  const results: MatchResult[] = connections.map((conn) => {
    const matchedWishId = conn.wish_a === params.id ? conn.wish_b : conn.wish_a
    const enrichment = enrichmentMap.get(matchedWishId)
    const matchedThemes: string[] = enrichment?.themes ?? []

    const sharedThemes = matchedThemes.filter((t) => ownThemes.has(t.toLowerCase().trim()))

    const matchSummaryMap: Record<string, string> = {
      strong:        'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה',
      complementary: 'משלים — אחד מציע מה שהשני צריך',
      similar:       'דומה — שאיפות וערכים משותפים',
      // legacy
      RESONANT:      'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה',
      COMPLEMENTARY: 'משלים — אחד מציע מה שהשני צריך',
      SIMILAR:       'דומה — שאיפות וערכים משותפים',
    }

    const ce = connEnrichMap.get(matchedWishId)
    // Determine which opportunity applies: if params.id is wish_a then opportunity_for_wish_a
    const isWishA = ce?.wish_a_id === params.id

    const result: MatchResult = {
      connection_id: conn.id,
      matched_wish_id: matchedWishId,
      match_score: conn.match_score,
      match_type: conn.match_type,
      status: conn.status,
      shared_themes: sharedThemes,
      match_summary: matchSummaryMap[conn.match_type] ?? 'התאמה',
      overall_connection_score: ce?.overall_connection_score ?? null,
      opportunity: ce ? (isWishA ? ce.opportunity_for_wish_a : ce.opportunity_for_wish_b) : null,
      shared_basis: ce?.shared_basis ?? null,
    }

    const wishData = contactMap.get(matchedWishId)
    result.contact = wishData
      ? { name: wishData.name, email: wishData.email, phone: wishData.phone }
      : { name: null, email: null, phone: null }
    result.matched_wish_text = wishData?.original_text ?? undefined

    // Extract short_reason from explanation JSONB column (migration 011)
    const explanation = (conn.explanation as { short_reason?: string } | null)
    result.explanation_text = explanation?.short_reason ?? undefined

    return result
  })

  return NextResponse.json(results)
}
