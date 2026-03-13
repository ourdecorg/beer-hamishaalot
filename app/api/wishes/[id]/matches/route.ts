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

  // Fetch enrichments for matched wishes
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('*')
    .in('wish_id', matchedWishIds)

  const enrichmentMap = new Map<string, WishEnrichment>(
    (enrichments ?? []).map((e) => [e.wish_id, e as WishEnrichment])
  )

  // Fetch this wish's own enrichment for theme comparison
  const { data: ownEnrichment } = await supabase
    .from('wish_enrichment')
    .select('themes')
    .eq('wish_id', params.id)
    .maybeSingle()

  const ownThemes = new Set<string>(
    (ownEnrichment?.themes ?? []).map((t: string) => t.toLowerCase().trim())
  )

  // Fetch contact info for all matched wishes
  const { data: contactWishes } = await supabase
    .from('wishes')
    .select('id, contact_name, contact_email, contact_phone')
    .in('id', matchedWishIds)

  const contactMap = new Map(
    (contactWishes ?? []).map((w) => [
      w.id,
      { name: w.contact_name, email: w.contact_email, phone: w.contact_phone },
    ])
  )

  // Build MatchResult array
  const results: MatchResult[] = connections.map((conn) => {
    const matchedWishId = conn.wish_a === params.id ? conn.wish_b : conn.wish_a
    const enrichment = enrichmentMap.get(matchedWishId)
    const matchedThemes: string[] = enrichment?.themes ?? []

    const sharedThemes = matchedThemes.filter((t) => ownThemes.has(t.toLowerCase().trim()))

    const matchSummaryMap: Record<string, string> = {
      RESONANT: 'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה',
      COMPLEMENTARY: 'משלים — אחד מציע מה שהשני צריך',
      SIMILAR: 'דומה — שאיפות וערכים משותפים',
    }

    const result: MatchResult = {
      connection_id: conn.id,
      matched_wish_id: matchedWishId,
      match_score: conn.match_score,
      match_type: conn.match_type,
      status: conn.status,
      shared_themes: sharedThemes,
      match_summary: matchSummaryMap[conn.match_type] ?? 'התאמה',
    }

    result.contact = contactMap.get(matchedWishId) ?? { name: null, email: null, phone: null }

    return result
  })

  return NextResponse.json(results)
}
