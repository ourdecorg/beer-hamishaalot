/**
 * Wish Resonance Engine — Orchestrator (v13 — semantic-only scoring)
 *
 * processWishForMatching(wishId, wishText) is the single entry point.
 * Pipeline:
 *   1. Deep analysis  → wish_enrichment (skip-if-exists)
 *   2. Embedding      → wish_embeddings English + original stored (skip-if-exists)
 *                    → wish_term_embeddings per-term needs/skills (skip-if-exists)
 *   3a. Semantic recall  → ANN candidates via English embedding (similarity ≥ MIN_SIMILARITY)
 *   3b. Structural recall → candidates with anchor_keywords overlap
 *   3c. Merge both channels, back-fill English similarity for structural-only candidates
 *   3d. Pre-load all term embeddings for batch (one DB query)
 *   4. Score          → match_score = semantic_en (sole ranking signal)
 *                    → complementarity logged for observability only
 *                    → structural logged for observability only
 *   5. Relevance gate → reject if semantic_en < 0.30
 *   6. Geo            → soft distance penalty (exp(-d/50))
 *   7. Date range     → hard filter
 *   8. Persist        → wish_connections (finalScore ≥ MATCH_THRESHOLD)
 *
 * Designed to be called fire-and-forget (never throws).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndStoreWish } from './analyze'
import { generateAndStoreEmbedding } from './embed'
import { generateAndStoreTermEmbeddings, loadTermVecsForWishes, computeEmbeddingComplementarity } from './complementEmbed'
import { findSimilarWishes, findStructuredCandidates, computeSimilaritiesForIds } from './similarity'
import { buildAnchorKeywords, computeStructuralSimilarity } from './keywords'
import { computeMatchScore, MATCH_THRESHOLD } from './score'
import { haversineKm } from './geo'
import { dateRangesOverlap } from './timeRange'
import { sendConnectionEmail } from '@/lib/email/sendConnectionEmail'
import type { WishEnrichment } from '@/lib/types'

/** Below this wish count, skip ANN and evaluate all pairs directly (same as admin batch full-scan). */
const FULL_SCAN_MAX = 300

type RecallSource = 'semantic' | 'structured' | 'both'

interface MergedCandidate {
  wish_id: string
  similarityEn: number
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
    await generateAndStoreTermEmbeddings(wishId, enrichment.needs, enrichment.skills_offered)
  } catch (err) {
    console.error('[ResonanceEngine] prepareWishForMatching failed:', err)
  }
}

export async function processWishForMatching(
  wishId: string,
  wishText: string,
  { onlyLowerId = false, explicitCandidateIds }: {
    onlyLowerId?: boolean
    /** When provided, skip ANN + structural recall and evaluate these IDs directly.
     *  Used for full-scan mode on small batches (≤ 300 wishes) to guarantee 100% pair coverage. */
    explicitCandidateIds?: string[]
  } = {}
): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Auto full-scan: when DB is small (≤ FULL_SCAN_MAX), skip ANN threshold and evaluate
    // all existing wishes directly — same code path as the admin batch runner.
    // Only include wishes that already have an embedding (wish_embeddings row exists),
    // otherwise computeSimilaritiesForIds will silently skip them and produce an empty result.
    if (explicitCandidateIds === undefined) {
      const { data: allWishes } = await supabase
        .from('wish_embeddings')
        .select('wish_id')
        .neq('wish_id', wishId)
      if (allWishes && allWishes.length <= FULL_SCAN_MAX) {
        explicitCandidateIds = allWishes.map((w: { wish_id: string }) => w.wish_id)
      }
    }

    // Step 1 — Deep analysis
    const enrichment = await analyzeAndStoreWish(wishId, wishText)

    // Step 2 — Generate + store both embeddings (original stored for future use, not used in scoring)
    const { en: embeddingEn } = await generateAndStoreEmbedding(wishId, wishText, enrichment)

    // Step 2b — Generate + store per-term embeddings for needs and skills (skip-if-exists)
    await generateAndStoreTermEmbeddings(wishId, enrichment.needs, enrichment.skills_offered)

    // Step 3 — Recall
    let annEnMap: Map<string, number>
    let structuredSet: Set<string>

    console.log(`[matching] wishId=${wishId} explicitCandidates=${explicitCandidateIds?.length ?? 'none (ANN)'}`)

    if (explicitCandidateIds !== undefined) {
      // Full-scan: compute English similarity for all explicit candidates directly —
      // bypasses ANN threshold so every pair is evaluated regardless of similarity floor.
      // Empty list (first wish in sorted order) → no candidates → pipeline exits at allIds.size===0.
      if (explicitCandidateIds.length > 0) {
        const dual = await computeSimilaritiesForIds(embeddingEn, null, explicitCandidateIds)
        annEnMap = dual.en
        console.log(`[matching] computeSimilaritiesForIds returned ${annEnMap.size} entries for ${explicitCandidateIds.length} candidates`)
      } else {
        annEnMap = new Map()
        console.log(`[matching] no candidates (first wish or empty explicit list)`)
      }
      structuredSet = new Set()
    } else {
      // Normal recall: ANN (English embedding) + structural
      // Step 3a — Semantic (ANN) recall via English embedding
      const annCandidates = await findSimilarWishes(wishId, embeddingEn, { onlyLowerId })
      annEnMap = new Map(annCandidates.map(c => [c.wish_id, c.similarity]))

      // Step 3b — Structural recall via anchor_keywords &&-overlap
      const sourceKeywords = buildAnchorKeywords(enrichment)
      const structuredCandidates = await findStructuredCandidates(wishId, sourceKeywords, { onlyLowerId })
      structuredSet = new Set(structuredCandidates.map(c => c.wish_id))
    }

    // Step 3c — Merge both recall channels
    const allIds = new Set([...annEnMap.keys(), ...structuredSet])

    console.log(`[matching] allIds.size=${allIds.size}`)
    if (allIds.size === 0) return

    // Back-fill English similarity for structural-only candidates
    const backfillIds = [...allIds].filter(id => !annEnMap.has(id))
    const extra = backfillIds.length > 0
      ? await computeSimilaritiesForIds(embeddingEn, null, backfillIds)
      : { en: new Map<string, number>(), orig: new Map<string, number>() }

    const merged: MergedCandidate[] = [...allIds].map(id => ({
      wish_id:      id,
      similarityEn: annEnMap.get(id) ?? extra.en.get(id) ?? 0,
      recallSource: (annEnMap.has(id) && structuredSet.has(id)) ? 'both'
        : annEnMap.has(id) ? 'semantic' : 'structured',
    }))

    // Fetch enrichments for all candidates in one query
    const { data: enrichments } = await supabase
      .from('wish_enrichment')
      .select('*')
      .in('wish_id', merged.map(c => c.wish_id))

    // Step 3d — Pre-load term embeddings for source + all candidates (one query)
    const termVecMap = await loadTermVecsForWishes([wishId, ...merged.map(c => c.wish_id)])

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
      intent_compatibility: number   // always 0 (legacy)
      domain_match: number
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
      )) {
        logEntries.push({
          wish_id:               wishId,
          candidate_wish_id:     candidate.wish_id,
          semantic_similarity:   Math.round(candidate.similarityEn * 1000) / 1000,
          complementarity_score: 0,
          theme_overlap:         0,
          intent_compatibility:  0,
          domain_match:          0,
          structural_similarity: 0,
          recall_source:         candidate.recallSource,
          geo_penalty:           1,
          match_score:           0,
          match_type:            null,
          passed_threshold:      false,
          gate_passed:           false,
          gate_reason:           'date_range_mismatch',
        })
        continue
      }

      let complementarityScore = 0
      let structuralSimilarity = 0
      let domainMatch = 0

      if (candidateEnrichment) {
        complementarityScore = computeEmbeddingComplementarity(termVecMap, wishId, candidate.wish_id).score
        structuralSimilarity = computeStructuralSimilarity(enrichment, candidateEnrichment)
        domainMatch          = (enrichment.primary_domain && enrichment.primary_domain === candidateEnrichment.primary_domain) ? 1 : 0
      }

      // Relevance gate (v13): semantic-only — complementarity does not rescue a candidate
      const passesRelevanceGate = candidate.similarityEn >= 0.30

      if (!passesRelevanceGate) {
        logEntries.push({
          wish_id:               wishId,
          candidate_wish_id:     candidate.wish_id,
          semantic_similarity:   Math.round(candidate.similarityEn  * 1000) / 1000,
          complementarity_score: Math.round(complementarityScore    * 1000) / 1000,
          theme_overlap:         0,
          intent_compatibility:  0,
          domain_match:          domainMatch,
          structural_similarity: Math.round(structuralSimilarity    * 1000) / 1000,
          recall_source:         candidate.recallSource,
          geo_penalty:           1,
          match_score:           0,
          match_type:            null,
          passed_threshold:      false,
          gate_passed:           false,
          gate_reason:           'low_semantic',
        })
        continue
      }

      const score = computeMatchScore(candidate.similarityEn)

      // Soft geo penalty
      const geoPenalty = candidateEnrichment ? distanceScore(enrichment, candidateEnrichment) : 1
      const finalScore = Math.round(score.match_score * geoPenalty * 1000) / 1000
      const passed = finalScore >= MATCH_THRESHOLD

      logEntries.push({
        wish_id:               wishId,
        candidate_wish_id:     candidate.wish_id,
        semantic_similarity:   Math.round(candidate.similarityEn  * 1000) / 1000,
        complementarity_score: Math.round(complementarityScore    * 1000) / 1000,
        theme_overlap:         0,
        intent_compatibility:  0,
        domain_match:          domainMatch,
        structural_similarity: Math.round(structuralSimilarity    * 1000) / 1000,
        recall_source:         candidate.recallSource,
        geo_penalty:           Math.round(geoPenalty              * 1000) / 1000,
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
    console.log(`[matching] logEntries=${logEntries.length} connections=${connections.length}`)
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

    // Send connection emails (fire-and-forget — never blocks the pipeline)
    console.log(`[email] ${connections.length} new connection(s) — starting email notify`)
    if (connections.length > 0 && !upsertError) {
      ;(async () => {
        try {
          const wishIds = connections.flatMap(c => [c.wish_a, c.wish_b])
          const { data: wishes, error: wishFetchErr } = await supabase
            .from('wishes')
            .select('id, original_text, contact_name, contact_email, contact_phone, contact_city')
            .in('id', wishIds)

          if (wishFetchErr) {
            console.error('[email] fetch wishes failed:', wishFetchErr.message)
            return
          }
          if (!wishes || wishes.length === 0) {
            console.warn('[email] no wish rows returned for ids:', wishIds)
            return
          }
          console.log(`[email] fetched ${wishes.length} wish row(s)`)

          const wishMap = new Map(wishes.map(w => [w.id, w]))

          for (const conn of connections) {
            const wA = wishMap.get(conn.wish_a)
            const wB = wishMap.get(conn.wish_b)
            if (!wA?.contact_email || !wB?.contact_email) {
              console.warn(`[email] skipping ${conn.wish_a}↔${conn.wish_b}: missing contact_email (A=${wA?.contact_email ?? 'null'} B=${wB?.contact_email ?? 'null'})`)
              continue
            }

            console.log(`[email] sending to ${wA.contact_email} + ${wB.contact_email}`)
            await sendConnectionEmail(
              {
                wishText:     wA.original_text,
                contactName:  wA.contact_name  ?? '',
                contactEmail: wA.contact_email,
                contactPhone: wA.contact_phone ?? null,
                contactCity:  wA.contact_city  ?? null,
              },
              {
                wishText:     wB.original_text,
                contactName:  wB.contact_name  ?? '',
                contactEmail: wB.contact_email,
                contactPhone: wB.contact_phone ?? null,
                contactCity:  wB.contact_city  ?? null,
              },
            )
            console.log(`[email] sent OK — from: ${process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'}`)
          }
        } catch (err) {
          console.error('[ResonanceEngine] sendConnectionEmail failed:', err)
        }
      })()
    }

  } catch (err) {
    console.error('[ResonanceEngine] processWishForMatching failed:', err)
  }
}
