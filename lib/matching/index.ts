/**
 * Wish Resonance Engine — Orchestrator
 *
 * processWishForMatching(wishId, wishText) is the single entry point.
 * It runs the full pipeline:
 *   1. Deep analysis  → wish_enrichment
 *   2. Embedding      → wish_embeddings
 *   3. Similarity     → top 10 candidate wishes
 *   4. Score + classify → wish_connections (upsert, score ≥ THRESHOLD)
 *
 * Designed to be called fire-and-forget (never throws).
 * Only runs for non-private wishes.
 */
import { createClient } from '@/lib/supabase/server'
import { analyzeAndStoreWish } from './analyze'
import { generateAndStoreEmbedding } from './embed'
import { findSimilarWishes } from './similarity'
import { computeComplementarity } from './complement'
import { computeMatchScore, MATCH_THRESHOLD } from './score'
import type { WishEnrichment } from '@/lib/types'

/**
 * Canonical pair ordering: always store (min, max) to match the DB check constraint.
 */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/**
 * Runs the full matching pipeline for a newly created wish.
 *
 * @param wishId   - UUID of the wish
 * @param wishText - The original wish text
 */
export async function processWishForMatching(
  wishId: string,
  wishText: string
): Promise<void> {
  try {
    const supabase = await createClient()

    // Step 1 — Deep analysis
    const enrichment = await analyzeAndStoreWish(wishId, wishText)

    // Step 2 — Generate + store embedding
    const embedding = await generateAndStoreEmbedding(wishId, wishText)

    // Step 3 — Find similar wishes by vector similarity
    const candidates = await findSimilarWishes(wishId, embedding, 10)
    if (candidates.length === 0) return

    // Fetch enrichments for all candidate wishes in one query
    const candidateIds = candidates.map((c) => c.wish_id)
    const { data: enrichments } = await supabase
      .from('wish_enrichment')
      .select('*')
      .in('wish_id', candidateIds)

    const enrichmentMap = new Map<string, WishEnrichment>(
      (enrichments ?? []).map((e) => [e.wish_id, e as WishEnrichment])
    )

    // Step 4 — Score each candidate and persist connections above threshold
    const connections: Array<{
      wish_a: string
      wish_b: string
      match_score: number
      match_type: string
      status: string
    }> = []

    for (const candidate of candidates) {
      const candidateEnrichment = enrichmentMap.get(candidate.wish_id)
      if (!candidateEnrichment) continue  // no enrichment yet — skip

      const complementarity = computeComplementarity(enrichment, candidateEnrichment)
      const score = computeMatchScore(candidate.similarity, complementarity)

      if (score.match_score < MATCH_THRESHOLD) continue

      const [wish_a, wish_b] = canonicalPair(wishId, candidate.wish_id)
      connections.push({
        wish_a,
        wish_b,
        match_score: Math.round(score.match_score * 1000) / 1000,
        match_type: score.match_type,
        status: 'connected',
      })
    }

    if (connections.length === 0) return

    // Upsert — ignore conflicts (existing connections keep their current status)
    await supabase
      .from('wish_connections')
      .upsert(connections, { onConflict: 'wish_a,wish_b', ignoreDuplicates: true })

  } catch (err) {
    // Never propagate — fire-and-forget
    console.error('[ResonanceEngine] processWishForMatching failed:', err)
  }
}
