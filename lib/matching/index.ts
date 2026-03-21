/**
 * Wish Resonance Engine — Orchestrator
 *
 * processWishForMatching(wishId, wishText) is the single entry point.
 * It runs the full pipeline:
 *   1. Deep analysis  → wish_enrichment
 *   2. Embedding      → wish_embeddings
 *   3. Similarity     → all public candidate wishes (no limit)
 *   4. Score + classify → wish_connections (upsert, score ≥ THRESHOLD)
 *
 * Designed to be called fire-and-forget (never throws).
 * Only runs for non-private wishes.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndStoreWish } from './analyze'
import { generateAndStoreEmbedding } from './embed'
import { findSimilarWishes } from './similarity'
import { computeComplementarity } from './complement'
import { computeIntentCompatibility } from './intent'
import { computeObjectAlignment } from './objectAlignment'
import { computeDomainMatch } from './domain'
import { computeMatchScore, computeFreshness, buildExplanation, MATCH_THRESHOLD } from './score'
import { haversineKm, MAX_DISTANCE_KM } from './geo'
import { dateRangesOverlap } from './timeRange'
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
  wishText: string,
  { onlyLowerId = false }: { onlyLowerId?: boolean } = {}
): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Step 1 — Deep analysis
    const enrichment = await analyzeAndStoreWish(wishId, wishText)

    // Step 2 — Generate + store embedding (enriched with domain context)
    const embedding = await generateAndStoreEmbedding(wishId, wishText, enrichment)

    // Step 3 — Find all public wishes by vector similarity (no limit)
    const candidates = await findSimilarWishes(wishId, embedding, { onlyLowerId })
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

    // Fetch candidate wish creation dates for freshness scoring
    const { data: candidateWishes } = await supabase
      .from('wishes')
      .select('id, created_at')
      .in('id', candidateIds)

    const dateMap = new Map<string, string>(
      (candidateWishes ?? []).map((w) => [w.id, w.created_at as string])
    )

    // Step 4 — Score each candidate, log every attempt, persist connections above threshold
    const connections: Array<{
      wish_a: string
      wish_b: string
      match_score: number
      match_type: string
      status: string
      explanation: object
    }> = []

    const logEntries: Array<{
      wish_id: string
      candidate_wish_id: string
      semantic_similarity: number
      complementarity_score: number
      theme_overlap: number
      intent_compatibility: number
      freshness_factor: number
      object_alignment: number
      domain_match: number
      match_score: number
      match_type: string | null
      passed_threshold: boolean
      distance_km: number | null
      failed_distance: boolean
      failed_date_range: boolean
    }> = []

    for (const candidate of candidates) {
      const candidateEnrichment = enrichmentMap.get(candidate.wish_id)
      if (!candidateEnrichment) continue  // no enrichment yet — skip

      const complementarity = computeComplementarity(enrichment, candidateEnrichment)
      const objectAlignment = computeObjectAlignment(enrichment, candidateEnrichment)
      const domainMatch = computeDomainMatch(enrichment.primary_domain, candidateEnrichment.primary_domain)

      const intentCompat = computeIntentCompatibility(
        enrichment.collaboration_type ?? 'connect',
        candidateEnrichment.collaboration_type ?? 'connect'
      )

      const freshness = computeFreshness(dateMap.get(candidate.wish_id) ?? new Date().toISOString())

      const score = computeMatchScore(candidate.similarity, complementarity, objectAlignment.score, intentCompat, freshness, domainMatch, objectAlignment.relation)
      const passed = score.match_score >= MATCH_THRESHOLD

      // Distance filter — only when both wishes have location coordinates
      let distance_km: number | null = null
      let failed_distance = false
      const aLat = enrichment.location_lat, aLng = enrichment.location_lng
      const bLat = candidateEnrichment.location_lat, bLng = candidateEnrichment.location_lng
      if (aLat != null && aLng != null && bLat != null && bLng != null) {
        distance_km = Math.round(haversineKm(aLat, aLng, bLat, bLng) * 10) / 10
        if (distance_km > MAX_DISTANCE_KM) failed_distance = true
      }

      // Date-range overlap filter
      const failed_date_range = !dateRangesOverlap(
        enrichment.date_range_start, enrichment.date_range_end,
        candidateEnrichment.date_range_start, candidateEnrichment.date_range_end,
      )

      logEntries.push({
          wish_id: wishId,
          candidate_wish_id: candidate.wish_id,
          semantic_similarity:   Math.round(candidate.similarity        * 1000) / 1000,
          complementarity_score: Math.round(complementarity.score       * 1000) / 1000,
          theme_overlap:         Math.round(complementarity.themeOverlap * 1000) / 1000,
          intent_compatibility:  Math.round(intentCompat                * 1000) / 1000,
          freshness_factor:      Math.round(freshness                   * 1000) / 1000,
          object_alignment:      Math.round(objectAlignment.score       * 1000) / 1000,
          domain_match:          Math.round(domainMatch                 * 1000) / 1000,
          match_score:           Math.round(score.match_score           * 1000) / 1000,
          match_type: passed ? score.match_type : null,
          passed_threshold: passed,
          distance_km,
          failed_distance,
          failed_date_range,
        })

      if (!passed || failed_distance || failed_date_range) continue

      const explanation = buildExplanation(
        score,
        complementarity,
        objectAlignment,
        enrichment.collaboration_type ?? 'connect',
        candidateEnrichment.collaboration_type ?? 'connect',
        enrichment.themes,
        candidateEnrichment.themes
      )

      const [wish_a, wish_b] = canonicalPair(wishId, candidate.wish_id)
      connections.push({
        wish_a,
        wish_b,
        match_score: Math.round(score.match_score * 1000) / 1000,
        match_type: score.match_type,
        status: 'connected',
        explanation,
      })
    }

    // Write log entries — passed matches and distance-rejected entries.
    if (logEntries.length > 0) {
      // Insert log entries with retry on timeout — fire-and-forget (no await)
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

    // Upsert — ignore conflicts (existing connections keep their current status)
    await supabase
      .from('wish_connections')
      .upsert(connections, { onConflict: 'wish_a,wish_b', ignoreDuplicates: true })

  } catch (err) {
    // Never propagate — fire-and-forget
    console.error('[ResonanceEngine] processWishForMatching failed:', err)
  }
}
