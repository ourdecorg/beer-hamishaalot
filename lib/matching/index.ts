/**
 * Wish Resonance Engine — Orchestrator (v8.5 — relevance gate)
 *
 * processWishForMatching(wishId, wishText) is the single entry point.
 * Pipeline:
 *   1. Deep analysis  → wish_enrichment (skip-if-exists)
 *   2. Embedding      → wish_embeddings (skip-if-exists)
 *   3a. Semantic recall  → ANN candidates (similarity ≥ MIN_SIMILARITY)
 *   3b. Structural recall → candidates with anchor_keywords overlap
 *   3c. Merge both channels, back-fill similarity for structural-only candidates
 *   4. Score          → 0.35×semantic + 0.30×complementarity + 0.15×intent + 0.20×structural
 *   5. Relevance gate → reject if semantic<0.30 AND complementarity<0.20 AND structural<0.25
 *   6. Geo            → soft distance penalty (exp(-d/50))
 *   7. Date range     → hard filter
 *   8. Persist        → wish_connections (finalScore ≥ MATCH_THRESHOLD)
 *
 * Designed to be called fire-and-forget (never throws).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndStoreWish } from './analyze'
import { generateAndStoreEmbedding } from './embed'
import { findSimilarWishes, findStructuredCandidates, computeSimilaritiesForIds } from './similarity'
import { computeComplementarity } from './complement'
import { computeIntentCompatibility } from './intent'
import { buildAnchorKeywords, computeStructuralSimilarity } from './keywords'
import { computeMatchScore, MATCH_THRESHOLD, MIN_SIMILARITY } from './score'
import { haversineKm } from './geo'
import { dateRangesOverlap } from './timeRange'
import type { WishEnrichment } from '@/lib/types'

type RecallSource = 'semantic' | 'structured' | 'both'

interface MergedCandidate {
  wish_id: string
  similarity: number
  recallSource: RecallSource
}

/** Canonical pair ordering: always store (min, max) to match DB check constraint. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Soft geo penalty: exp(-distance_km / 50). Returns 1 if no location on either side. */
function distanceScore(a: WishEnrichment, b: WishEnrichment): number {
  const { location_lat: aLat, location_lng: aLng } = a
  const { location_lat: bLat, location_lng: bLng } = b
  if (aLat == null || aLng == null || bLat == null || bLng == null) return 1
  const km = haversineKm(aLat, aLng, bLat, bLng)
  return Math.exp(-km / 50)
}

/**
 * Phase 1 only — enrichment + embedding (no matching).
 * Used by the batch runner to ensure all wishes are prepared
 * before any matching begins.
 */
export async function prepareWishForMatching(
  wishId: string,
  wishText: string,
): Promise<void> {
  try {
    const enrichment = await analyzeAndStoreWish(wishId, wishText)
    await generateAndStoreEmbedding(wishId, wishText, enrichment)
  } catch (err) {
    console.error('[ResonanceEngine] prepareWishForMatching failed:', err)
  }
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

    // Step 3a — Semantic (ANN) recall
    const annCandidates = await findSimilarWishes(wishId, embedding, { onlyLowerId })

    // Step 3b — Structural recall via anchor_keywords &&-overlap
    const sourceKeywords = buildAnchorKeywords(enrichment)
    const structuredCandidates = await findStructuredCandidates(wishId, sourceKeywords, { onlyLowerId })

    // Step 3c — Merge both recall channels
    const annMap = new Map(annCandidates.map(c => [c.wish_id, c.similarity]))
    const structuredSet = new Set(structuredCandidates.map(c => c.wish_id))
    const allIds = new Set([...annMap.keys(), ...structuredSet])

    if (allIds.size === 0) return

    // Back-fill similarity for structured-only candidates (not in ANN results)
    const structuredOnlyIds = [...structuredSet].filter(id => !annMap.has(id))
    const extraSimilarities = await computeSimilaritiesForIds(embedding, structuredOnlyIds)

    const merged: MergedCandidate[] = [...allIds].map(id => ({
      wish_id:      id,
      similarity:   annMap.get(id) ?? extraSimilarities.get(id) ?? 0,
      recallSource: (annMap.has(id) && structuredSet.has(id)) ? 'both'
        : annMap.has(id) ? 'semantic' : 'structured',
    }))

    // Fetch enrichments for all candidates in one query
    const { data: enrichments } = await supabase
      .from('wish_enrichment')
      .select('*')
      .in('wish_id', merged.map(c => c.wish_id))

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
      theme_overlap: number          // NOT NULL in DB — always 0 (legacy)
      intent_compatibility: number
      domain_match: number           // kept for observability (existing column)
      structural_similarity: number
      recall_source: string
      geo_penalty: number
      match_score: number
      match_type: string | null
      passed_threshold: boolean
      gate_passed: boolean
      gate_reason: string
    }> = []

    for (const candidate of merged) {
      const candidateEnrichment = enrichmentMap.get(candidate.wish_id)

      // Date-range hard filter
      if (!dateRangesOverlap(
        enrichment.date_range_start, enrichment.date_range_end,
        candidateEnrichment?.date_range_start, candidateEnrichment?.date_range_end,
      )) continue

      let complementarityScore = 0
      let intentCompatibility = 0
      let structuralSimilarity = 0
      let domainMatch = 0

      if (candidateEnrichment) {
        complementarityScore  = computeComplementarity(enrichment, candidateEnrichment).score
        intentCompatibility   = computeIntentCompatibility(
          enrichment.collaboration_type ?? 'connect',
          candidateEnrichment.collaboration_type ?? 'connect',
        )
        structuralSimilarity  = computeStructuralSimilarity(enrichment, candidateEnrichment)
        domainMatch           = (enrichment.primary_domain && enrichment.primary_domain === candidateEnrichment.primary_domain) ? 1 : 0
      }

      // Relevance gate (v8.5): reject only if all three weak signals are below thresholds
      const passesRelevanceGate =
        candidate.similarity  >= 0.30 ||
        complementarityScore  >= 0.20 ||
        structuralSimilarity  >= 0.25

      if (!passesRelevanceGate) {
        logEntries.push({
          wish_id:               wishId,
          candidate_wish_id:     candidate.wish_id,
          semantic_similarity:   Math.round(candidate.similarity      * 1000) / 1000,
          complementarity_score: Math.round(complementarityScore      * 1000) / 1000,
          theme_overlap:         0,
          intent_compatibility:  Math.round(intentCompatibility       * 1000) / 1000,
          domain_match:          domainMatch,
          structural_similarity: Math.round(structuralSimilarity      * 1000) / 1000,
          recall_source:         candidate.recallSource,
          geo_penalty:           1,
          match_score:           0,
          match_type:            null,
          passed_threshold:      false,
          gate_passed:           false,
          gate_reason:           'low_semantic_low_complementarity_low_structural',
        })
        continue
      }

      const score = computeMatchScore(
        candidate.similarity,
        complementarityScore,
        intentCompatibility,
        structuralSimilarity,
      )

      // Soft geo penalty
      const geoPenalty = candidateEnrichment ? distanceScore(enrichment, candidateEnrichment) : 1
      const finalScore = Math.round(score.match_score * geoPenalty * 1000) / 1000
      const passed = finalScore >= MATCH_THRESHOLD

      logEntries.push({
        wish_id:               wishId,
        candidate_wish_id:     candidate.wish_id,
        semantic_similarity:   Math.round(candidate.similarity      * 1000) / 1000,
        complementarity_score: Math.round(complementarityScore      * 1000) / 1000,
        theme_overlap:         0,
        intent_compatibility:  Math.round(intentCompatibility       * 1000) / 1000,
        domain_match:          domainMatch,
        structural_similarity: Math.round(structuralSimilarity      * 1000) / 1000,
        recall_source:         candidate.recallSource,
        geo_penalty:           Math.round(geoPenalty                * 1000) / 1000,
        match_score:           finalScore,
        match_type:            passed ? score.match_type : null,
        passed_threshold:      passed,
        gate_passed:           true,
        gate_reason:           'passed',
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
