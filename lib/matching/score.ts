/**
 * Match Scoring Engine (v7 — 5 signals)
 *
 * Formula:
 *   match_score = 0.35 × semantic_similarity
 *               + 0.25 × complementarity
 *               + 0.15 × intent_compatibility
 *               + 0.15 × domain_match      (1 if same primary_domain, else 0)
 *               + 0.15 × anchor_overlap    (0 / 0.5 / 1 — see anchor.ts)
 *
 * Weights sum to 1.05 — Math.min(1, …) keeps score in [0, 1].
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
  domain_match: number
  anchor_overlap: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarityScore: number,
  intentCompatibility: number,
  domainMatch: number,
  anchorOverlap: number,
): MatchScore {
  const match_score = Math.min(1,
    0.35 * semanticSimilarity +
    0.25 * complementarityScore +
    0.15 * intentCompatibility +
    0.15 * domainMatch +
    0.15 * anchorOverlap,
  )

  let match_type: MatchType
  if (match_score >= 0.75)             match_type = 'strong'
  else if (complementarityScore > 0.5) match_type = 'complementary'
  else                                 match_type = 'similar'

  return { match_score, match_type, semantic_similarity: semanticSimilarity, complementarity: complementarityScore, intent_compatibility: intentCompatibility, domain_match: domainMatch, anchor_overlap: anchorOverlap }
}
