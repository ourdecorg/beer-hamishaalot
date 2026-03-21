/**
 * Wish Resonance Engine — Orchestrator (v5 — simplified)
 *
 * processWishForMatching(wishId, wishText) is the single entry point.
 * Pipeline:
 *   1. Deep analysis  → wish_enrichment
 *   2. Embedding      → wish_embeddings
 *   3. Similarity     → ANN candidates (similarity ≥ MIN_SIMILARITY)
 *   4. Score          → 0.60×semantic + 0.25×complementarity + 0.15×intent
 *   5. Geo            → soft distance penalty (exp(-d/50))
 *   6. Date range     → hard filter (reject if no overlap)
 *   7. Persist        → wish_connections (score ≥ MATCH_THRESHOLD)
 *
 * Designed to be called fire-and-forget (never throws).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndStoreWish } from './analyze'
import { generateAndStoreEmbedding } from './embed'
import { findSimilarWishes } from './similarity'
import { computeComplementarity } from './complement'
import { computeIntentCompatibility } from './intent'
import { computeMatchScore, MATCH_THRESHOLD } from './score'
import { haversineKm } from './geo'
import { dateRangesOverlap } from './timeRange'
import type { WishEnrichment } from '@/lib/types'

/** Canonical pair ordering: always store (min, max) to match DB check constraint. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Jaccard similarity between two keyword arrays (case-insensitive). */
function computeKeywordsJaccard(a: string[] | null | undefined, b: string[] | null | undefined): number {
  if (!a?.length || !b?.length) return 0
  const setA = new Set(a.map(s => s.toLowerCase().trim()))
  const setB = new Set(b.map(s => s.toLowerCase().trim()))
  const inter = [...setA].filter(x => setB.has(x)).length
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

/** Soft geo penalty: exp(-distance_km / 50). Returns 1 if no location on either side. */
function distanceScore(a: WishEnrichment, b: WishEnrichment): number {
  const { location_lat: aLat, location_lng: aLng } = a
  const { location_lat: bLat, location_lng: bLng } = b
  if (aLat == null || aLng == null || bLat == null || bLng == null) return 1
  const km = haversineKm(aLat, aLng, bLat, bLng)
  return Math.exp(-km / 50)
}

export async function processWishForMatching(
  wishId: string,
  wishText: string,
  { onlyLowerId = false }: { onlyLowerId?: boolean } = {}
): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Step 1 — Deep analysis
    const enrichment = await analyzeAndStoreWish(wishId, wishText)

    // Step 2 — Generate + store embedding
    const embedding = await generateAndStoreEmbedding(wishId, wishText, enrichment)

    // Step 3 — Find similar wishes by vector similarity
    const candidates = await findSimilarWishes(wishId, embedding, { onlyLowerId })
    if (candidates.length === 0) return

    // Fetch enrichments for all candidates in one query
    const candidateIds = candidates.map((c) => c.wish_id)
    const { data: enrichments } = await supabase
      .from('wish_enrichment')
      .select('*')
      .in('wish_id', candidateIds)

    const enrichmentMap = new Map<string, WishEnrichment>(
      (enrichments ?? []).map((e) => [e.wish_id, e as WishEnrichment])
    )

    // Step 4 — Score each candidate
    const connections: Array<{
      wish_a: string
      wish_b: string
      match_score: number
      match_type: string
      status: string
    }> = []

    const logEntries: Array<{
      wish_id: string
      candidate_wish_id: string
      semantic_similarity: number
      complementarity_score: number
      theme_overlap: number          // NOT NULL in DB — always 0 (removed from scoring)
      intent_compatibility: number
      keywords_jaccard: number
      geo_penalty: number
      match_score: number
      match_type: string | null
      passed_threshold: boolean
    }> = []

    for (const candidate of candidates) {
      const candidateEnrichment = enrichmentMap.get(candidate.wish_id)

      // Date-range hard filter
      if (!dateRangesOverlap(
        enrichment.date_range_start, enrichment.date_range_end,
        candidateEnrichment?.date_range_start, candidateEnrichment?.date_range_end,
      )) continue

      let complementarityScore = 0
      let intentCompatibility = 0

      let keywordsJaccard = 0
      if (candidateEnrichment) {
        complementarityScore = computeComplementarity(enrichment, candidateEnrichment).score
        intentCompatibility  = computeIntentCompatibility(
          enrichment.collaboration_type ?? 'connect',
          candidateEnrichment.collaboration_type ?? 'connect',
        )
        keywordsJaccard = computeKeywordsJaccard(enrichment.keywords, candidateEnrichment.keywords)
      }
      // Fallback: no enrichment → pure semantic match
      const score = computeMatchScore(candidate.similarity, complementarityScore, intentCompatibility, keywordsJaccard)

      // Soft geo penalty
      const geoPenalty = candidateEnrichment ? distanceScore(enrichment, candidateEnrichment) : 1
      const finalScore = Math.round(score.match_score * geoPenalty * 1000) / 1000
      const passed = finalScore >= MATCH_THRESHOLD

      logEntries.push({
        wish_id:               wishId,
        candidate_wish_id:     candidate.wish_id,
        semantic_similarity:   Math.round(candidate.similarity       * 1000) / 1000,
        complementarity_score: Math.round(complementarityScore       * 1000) / 1000,
        theme_overlap:         0,   // removed from scoring; NOT NULL so must pass
        intent_compatibility:  Math.round(intentCompatibility        * 1000) / 1000,
        keywords_jaccard:      Math.round(keywordsJaccard            * 1000) / 1000,
        geo_penalty:           Math.round(geoPenalty                 * 1000) / 1000,
        match_score:           finalScore,
        match_type:            passed ? score.match_type : null,
        passed_threshold:      passed,
      })

      if (!passed) continue

      const [wish_a, wish_b] = canonicalPair(wishId, candidate.wish_id)
      connections.push({
        wish_a,
        wish_b,
        match_score: finalScore,
        match_type:  score.match_type,
        status:      'connected',
      })
    }

    // Write log entries (fire-and-forget with retry)
    if (logEntries.length > 0) {
      ;(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase.from('match_attempts_log').insert(logEntries)
          if (!error) break
          const isTimeout = error.message.includes('timeout') || error.message.includes('upstream')
          if (isTimeout && attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
            continue
          }
          console.error('[ResonanceEngine] log insert failed:', error.message)
          break
        }
      })()
    }

    if (connections.length === 0) return

    const { error: upsertError } = await supabase
      .from('wish_connections')
      .upsert(connections, { onConflict: 'wish_a,wish_b', ignoreDuplicates: true })
    if (upsertError) {
      console.error('[ResonanceEngine] upsert failed:', upsertError.message)
    }

  } catch (err) {
    console.error('[ResonanceEngine] processWishForMatching failed:', err)
  }
}
