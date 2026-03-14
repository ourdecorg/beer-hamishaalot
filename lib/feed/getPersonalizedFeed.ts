/**
 * getPersonalizedFeed
 *
 * Main entry point for the personalized feed engine.
 *
 * Pipeline:
 *   1. Build the user's interest profile (themes, skills, needs, interest vector)
 *   2. Collect their resonated wish IDs (behavioral signal)
 *   3. Find candidate wishes via pgvector cosine search (if interest vector exists)
 *      OR via theme-Jaccard similarity (cold-start fallback)
 *   4. Score each candidate with the weighted relevance formula
 *   5. Rank and diversify into the final feed
 *
 * Cold start (no wish history, no resonances): returns a chronological trending
 * feed so new users always see something useful.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WishEnrichment, WishWithResonance } from '@/lib/types'
import { buildUserProfile } from './buildUserProfile'
import { scoreWish } from './scoreWish'
import { rankWishes } from './rankWishes'
import type { FeedResult, ScoredWish } from './types'

const CANDIDATE_LIMIT = 60
const FEED_LIMIT = 30

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Jaccard similarity between two string arrays (used as semantic fallback). */
function themeJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a.map(s => s.toLowerCase()))
  const setB = new Set(b.map(s => s.toLowerCase()))
  const intersection = Array.from(setA).filter(x => setB.has(x)).length
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Fetch full wish records, enrichments, and resonance counts for a list of IDs.
 * Returns a map keyed by wish_id.
 */
async function fetchWishDetails(
  wishIds: string[],
  userId: string,
  resonatedIds: Set<string>,
  supabase: SupabaseClient
): Promise<{
  wishes: WishWithResonance[]
  enrichmentMap: Map<string, WishEnrichment>
}> {
  if (wishIds.length === 0) return { wishes: [], enrichmentMap: new Map() }

  const [wishesResult, enrichmentsResult, resonancesResult] = await Promise.all([
    supabase
      .from('wishes')
      .select('id, user_id, original_text, ai_summary, ai_tags, intention_statement, visibility, is_ai_enriched, created_at, updated_at, user_email')
      .in('id', wishIds)
      .neq('user_id', userId)                           // exclude own wishes
      .in('visibility', ['anonymous', 'open']),

    supabase
      .from('wish_enrichment')
      .select('wish_id, themes, intent, needs, skills_offered, collaboration_type, emotional_tone, analyzed_at')
      .in('wish_id', wishIds),

    supabase
      .from('wish_resonances')
      .select('wish_id')
      .in('wish_id', wishIds),
  ])

  // Count resonances per wish
  const resonanceCountMap = new Map<string, number>()
  for (const r of resonancesResult.data ?? []) {
    resonanceCountMap.set(r.wish_id, (resonanceCountMap.get(r.wish_id) ?? 0) + 1)
  }

  const enrichmentMap = new Map<string, WishEnrichment>(
    (enrichmentsResult.data ?? []).map(e => [e.wish_id, e])
  )

  const wishes: WishWithResonance[] = (wishesResult.data ?? []).map(w => ({
    ...w,
    // Null-fill contact fields — not needed in the public feed view
    contact_name: null, contact_email: null, contact_country: null,
    contact_city: null, contact_address: null, contact_phone: null,
    resonance_count: resonanceCountMap.get(w.id) ?? 0,
    user_has_resonated: resonatedIds.has(w.id),
  }))

  return { wishes, enrichmentMap }
}

// ── Vector path ───────────────────────────────────────────────────────────────

/**
 * Uses the `feed_match_wishes` SECURITY DEFINER RPC to find semantically
 * similar candidates via pgvector cosine search, then scores them.
 */
async function getScoredViaEmbedding(
  profile: ReturnType<typeof buildUserProfile> extends Promise<infer T> ? T : never,
  userId: string,
  resonatedIds: Set<string>,
  supabase: SupabaseClient
): Promise<ScoredWish[]> {
  const { data: matches, error } = await supabase.rpc('feed_match_wishes', {
    query_embedding: profile.interestVector,
    exclude_user_id: userId,
    match_count: CANDIDATE_LIMIT,
  })

  if (error || !matches?.length) return []

  const wishIds = (matches as { wish_id: string; similarity: number }[]).map(m => m.wish_id)
  const similarityMap = new Map<string, number>(
    (matches as { wish_id: string; similarity: number }[]).map(m => [m.wish_id, m.similarity])
  )

  const { wishes, enrichmentMap } = await fetchWishDetails(wishIds, userId, resonatedIds, supabase)

  return wishes.map(w =>
    scoreWish(w, enrichmentMap.get(w.id) ?? null, similarityMap.get(w.id) ?? 0, profile, resonatedIds)
  )
}

// ── Theme-Jaccard fallback path ───────────────────────────────────────────────

/**
 * When no interest vector is available, fetches recent candidates and uses
 * theme Jaccard similarity as a proxy for semantic relevance.
 */
async function getScoredViaThemes(
  profile: ReturnType<typeof buildUserProfile> extends Promise<infer T> ? T : never,
  userId: string,
  resonatedIds: Set<string>,
  supabase: SupabaseClient
): Promise<ScoredWish[]> {
  const { data: recentIds } = await supabase
    .from('wishes')
    .select('id')
    .in('visibility', ['anonymous', 'open'])
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(CANDIDATE_LIMIT)

  if (!recentIds?.length) return []

  const wishIds = recentIds.map(w => w.id)
  const { wishes, enrichmentMap } = await fetchWishDetails(wishIds, userId, resonatedIds, supabase)

  return wishes.map(w => {
    const enrichment = enrichmentMap.get(w.id) ?? null
    const semanticSim = themeJaccard(profile.themes, enrichment?.themes ?? [])
    return scoreWish(w, enrichment, semanticSim, profile, resonatedIds)
  })
}

// ── Cold-start fallback ───────────────────────────────────────────────────────

/**
 * For users with no history: return recent public wishes ranked by freshness
 * and community engagement (resonance count).
 */
async function getTrendingFeed(userId: string, supabase: SupabaseClient): Promise<FeedResult> {
  const { data: raw } = await supabase
    .from('wishes')
    .select('id, user_id, original_text, ai_summary, ai_tags, intention_statement, visibility, is_ai_enriched, created_at, updated_at, user_email')
    .in('visibility', ['anonymous', 'open'])
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!raw?.length) return { wishes: [], personalized: false, profile_strength: 'none' }

  const wishIds = raw.map(w => w.id)
  const [{ data: enrichments }, { data: resonances }] = await Promise.all([
    supabase.from('wish_enrichment').select('wish_id').in('wish_id', wishIds),
    supabase.from('wish_resonances').select('wish_id').in('wish_id', wishIds),
  ])

  const enrichedSet = new Set((enrichments ?? []).map(e => e.wish_id))
  const resonanceCountMap = new Map<string, number>()
  for (const r of resonances ?? []) {
    resonanceCountMap.set(r.wish_id, (resonanceCountMap.get(r.wish_id) ?? 0) + 1)
  }

  const wishes: ScoredWish[] = raw.map(w => {
    const resonance_count = resonanceCountMap.get(w.id) ?? 0
    const hasEnrich = enrichedSet.has(w.id)
    const ageDays = (Date.now() - new Date(w.created_at).getTime()) / 86_400_000
    const freshness = Math.exp(-ageDays / 20)
    const quality = (hasEnrich ? 0.5 : w.is_ai_enriched ? 0.25 : 0)
      + Math.min(0.5, Math.log1p(resonance_count) / Math.log1p(10))

    return {
      ...w,
      contact_name: null, contact_email: null, contact_country: null,
      contact_city: null, contact_address: null, contact_phone: null,
      resonance_count,
      user_has_resonated: false,
      enrichment: null,
      relevance_score: 0.5 * freshness + 0.5 * quality,
      feed_bucket: 'relevant' as const,
      score_breakdown: { semantic: 0, complementarity: 0, behavioral: 0, freshness, quality },
    }
  })

  const sorted = wishes.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, FEED_LIMIT)
  return { wishes: sorted, personalized: false, profile_strength: 'none' }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getPersonalizedFeed(
  userId: string,
  supabase: SupabaseClient
): Promise<FeedResult> {
  try {
    // 1. Build user's interest profile
    const profile = await buildUserProfile(userId, supabase)

    // 2. Collect behavioral signals (resonances already tracked)
    const { data: resonances } = await supabase
      .from('wish_resonances')
      .select('wish_id')
      .eq('user_id', userId)
    const resonatedIds = new Set<string>((resonances ?? []).map(r => r.wish_id))

    // 3. Cold start: user has no history at all → trending feed
    if (profile.wishCount === 0 && resonatedIds.size === 0) {
      return getTrendingFeed(userId, supabase)
    }

    const profile_strength: FeedResult['profile_strength'] =
      profile.enrichedWishCount >= 2 ? 'full' : profile.wishCount > 0 ? 'partial' : 'none'

    // 4. Score candidates
    const scored = profile.interestVector
      ? await getScoredViaEmbedding(profile, userId, resonatedIds, supabase)
      : await getScoredViaThemes(profile, userId, resonatedIds, supabase)

    // 5. Cold-start fallback if scoring returned nothing
    if (scored.length === 0) return getTrendingFeed(userId, supabase)

    // 6. Rank and diversify
    const ranked = rankWishes(scored, FEED_LIMIT)

    return { wishes: ranked, personalized: true, profile_strength }
  } catch (err) {
    // Never crash the feed page — fall back to trending
    console.error('[feed] getPersonalizedFeed error:', err)
    return getTrendingFeed(userId, supabase)
  }
}
