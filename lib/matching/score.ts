/**
 * Match Scoring Engine (v8 — 4 signals)
 *
 * Formula:
 *   match_score = 0.35 × semantic_similarity
 *               + 0.30 × complementarity
 *               + 0.15 × intent_compatibility
 *               + 0.20 × structural_similarity
 *
 * structural_similarity = computeStructuralSimilarity(a, b) in keywords.ts
 *   Counts field-level overlaps (needs↔skills, entities, primary_domain) / 4, capped at 1.
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
  intent_compatibility: number
  structural_similarity: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarityScore: number,
  intentCompatibility: number,
  structuralSimilarity: number,
): MatchScore {
  const match_score = Math.min(1,
    0.35 * semanticSimilarity +
    0.30 * complementarityScore +
    0.15 * intentCompatibility +
    0.20 * structuralSimilarity,
  )

  let match_type: MatchType
  if (match_score >= 0.75)             match_type = 'strong'
  else if (complementarityScore > 0.5) match_type = 'complementary'
  else                                 match_type = 'similar'

  return {
    match_score,
    match_type,
    semantic_similarity:   semanticSimilarity,
    complementarity:       complementarityScore,
    intent_compatibility:  intentCompatibility,
    structural_similarity: structuralSimilarity,
  }
}
