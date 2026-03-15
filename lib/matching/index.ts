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
    const supabase = createAdminClient()

    // Step 1 — Deep analysis
    const enrichment = await analyzeAndStoreWish(wishId, wishText)

    // Step 2 — Generate + store embedding
    const embedding = await generateAndStoreEmbedding(wishId, wishText)

    // Step 3 — Find all public wishes by vector similarity (no limit)
    const candidates = await findSimilarWishes(wishId, embedding)
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

    // Lazy enrichment: if a candidate's enrichment isn't ready yet (race condition),
    // fetch its text and analyze it now so we don't miss the connection.
    const missingIds = candidateIds.filter((id) => !enrichmentMap.has(id))
    if (missingIds.length > 0) {
      const { data: missingWishes } = await supabase
        .from('wishes')
        .select('id, original_text, ai_summary')
        .in('id', missingIds)

      await Promise.allSettled(
        (missingWishes ?? []).map(async (w) => {
          const text = (w.original_text || w.ai_summary) as string | null
          if (!text) return
          const enrichment = await analyzeAndStoreWish(w.id, text)
          enrichmentMap.set(w.id, enrichment)
        })
      )
    }

    // Step 4 — Score each candidate, log every attempt, persist connections above threshold
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
      theme_overlap: number
      match_score: number
      match_type: string | null
      passed_threshold: boolean
    }> = []

    for (const candidate of candidates) {
      const candidateEnrichment = enrichmentMap.get(candidate.wish_id)
      if (!candidateEnrichment) continue  // no enrichment yet — skip

      const complementarity = computeComplementarity(enrichment, candidateEnrichment)
      const score = computeMatchScore(candidate.similarity, complementarity)
      const passed = score.match_score >= MATCH_THRESHOLD

      logEntries.push({
        wish_id: wishId,
        candidate_wish_id: candidate.wish_id,
        semantic_similarity: Math.round(candidate.similarity * 1000) / 1000,
        complementarity_score: Math.round(complementarity.score * 1000) / 1000,
        theme_overlap: Math.round(complementarity.themeOverlap * 1000) / 1000,
        match_score: Math.round(score.match_score * 1000) / 1000,
        match_type: passed ? score.match_type : null,
        passed_threshold: passed,
      })

      if (!passed) continue

      const [wish_a, wish_b] = canonicalPair(wishId, candidate.wish_id)
      connections.push({
        wish_a,
        wish_b,
        match_score: Math.round(score.match_score * 1000) / 1000,
        match_type: score.match_type,
        status: 'connected',
      })
    }

    // Write log entries (best-effort, non-blocking)
    if (logEntries.length > 0) {
      supabase.from('match_attempts_log').insert(logEntries).then(({ error }) => {
        if (error) console.error('[ResonanceEngine] log insert failed:', error.message)
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
