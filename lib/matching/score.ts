/**
 * Match Scoring Engine (v6 — 4 signals)
 *
 * Formula:
 *   match_score = 0.45 × semantic_similarity
 *               + 0.25 × complementarity
 *               + 0.15 × intent_compatibility
 *               + 0.15 × keywords_jaccard
 */
import type { MatchType } from '@/lib/types'

export const MATCH_THRESHOLD = 0.48   // minimum score to persist a connection
export const MIN_SIMILARITY  = 0.30   // minimum cosine similarity to enter scoring

export interface MatchScore {
  match_score: number
  match_type: MatchType
  semantic_similarity: number
  complementarity: number
  intent_compatibility: number
  keywords_jaccard: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarityScore: number,
  intentCompatibility: number,
  keywordsJaccard: number,
): MatchScore {
  const match_score = Math.min(1,
    0.45 * semanticSimilarity +
    0.25 * complementarityScore +
    0.15 * intentCompatibility +
    0.15 * keywordsJaccard,
  )

  let match_type: MatchType
  if (match_score >= 0.75)             match_type = 'strong'
  else if (complementarityScore > 0.5) match_type = 'complementary'
  else                                 match_type = 'similar'

  return { match_score, match_type, semantic_similarity: semanticSimilarity, complementarity: complementarityScore, intent_compatibility: intentCompatibility, keywords_jaccard: keywordsJaccard }
}
