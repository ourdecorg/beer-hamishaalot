/**
 * Match Scoring Engine (v12 — 2 signals)
 *
 * Formula:
 *   match_score = 0.70 × semantic_similarity   (English embedding — cross-lingual ANN)
 *               + 0.30 × complementarity        (needs ↔ skills pairwise embedding similarity)
 *
 * Weights sum to exactly 1.00.
 */
import type { MatchType } from '@/lib/types'

export const MATCH_THRESHOLD = 0.48   // minimum final_score to persist a connection
export const MIN_SIMILARITY  = 0.30   // minimum cosine similarity for ANN recall

export interface MatchScore {
  match_score: number
  match_type: MatchType
  semantic_similarity: number
  complementarity: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarityScore: number,
): MatchScore {
  const match_score = Math.min(1,
    0.70 * semanticSimilarity  +
    0.30 * complementarityScore,
  )

  let match_type: MatchType
  if (match_score >= 0.75)             match_type = 'strong'
  else if (complementarityScore > 0.5) match_type = 'complementary'
  else                                 match_type = 'similar'

  return {
    match_score,
    match_type,
    semantic_similarity: semanticSimilarity,
    complementarity:     complementarityScore,
  }
}
