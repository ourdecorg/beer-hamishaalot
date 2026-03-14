/**
 * Match Scoring Engine
 *
 * Combines semantic similarity, complementarity, and theme overlap into a
 * single match_score and classifies the relationship type.
 *
 * Formula:
 *   match_score = 0.5 × semantic_similarity
 *               + 0.3 × complementarity_score
 *               + 0.2 × theme_overlap
 *
 * Classification:
 *   RESONANT      — match_score ≥ 0.80 (everything aligned)
 *   COMPLEMENTARY — complementarity > 0.60 (strong skill↔need fit)
 *   SIMILAR       — match_score ≥ THRESHOLD (similar goals/themes)
 */
import type { MatchType } from '@/lib/types'
import type { ComplementarityScore } from './complement'

export const MATCH_THRESHOLD = 0.25  // minimum score to persist a connection

export interface MatchScore {
  match_score: number
  match_type: MatchType
  semantic_similarity: number
  complementarity: number
  theme_overlap: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarity: ComplementarityScore
): MatchScore {
  const { score: complementScore, themeOverlap } = complementarity

  const match_score =
    0.5 * semanticSimilarity +
    0.3 * complementScore +
    0.2 * themeOverlap

  let match_type: MatchType
  if (match_score >= 0.80) {
    match_type = 'RESONANT'
  } else if (complementScore > 0.60) {
    match_type = 'COMPLEMENTARY'
  } else {
    match_type = 'SIMILAR'
  }

  return {
    match_score: Math.min(1, match_score),
    match_type,
    semantic_similarity: semanticSimilarity,
    complementarity: complementScore,
    theme_overlap: themeOverlap,
  }
}

/**
 * Human-readable summary for the match card UI.
 */
export function buildMatchSummary(score: MatchScore): string {
  switch (score.match_type) {
    case 'RESONANT':
      return 'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה'
    case 'COMPLEMENTARY':
      return score.complementarity > score.theme_overlap
        ? 'משלים — אחד מציע מה שהשני צריך'
        : 'משלים — יכולות וצרכים מסתדרים היטב'
    case 'SIMILAR':
    default:
      return 'דומה — שאיפות וערכים משותפים'
  }
}
