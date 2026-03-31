/**
 * Match Scoring Engine (v13 — semantic-only)
 *
 * Formula:
 *   match_score = semantic_similarity   (English embedding — cross-lingual ANN)
 *   final_score = match_score × exp(-distance_km / 50)
 *
 * Complementarity is computed and logged separately for observability
 * but does not affect the score, gate, or match_type.
 */
import type { MatchType } from '@/lib/types'

export const MATCH_THRESHOLD = 0.48   // minimum final_score to persist a connection
export const MIN_SIMILARITY  = 0.30   // minimum cosine similarity for ANN recall

export interface MatchScore {
  match_score: number
  match_type:  MatchType
}

export function computeMatchScore(semanticSimilarity: number): MatchScore {
  const match_score = Math.min(1, semanticSimilarity)
  const match_type: MatchType = match_score >= 0.75 ? 'strong' : 'similar'
  return { match_score, match_type }
}
