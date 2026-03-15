/**
 * Match Scoring Engine
 *
 * Combines semantic similarity, complementarity, intent compatibility,
 * theme overlap, and freshness into a single match_score.
 *
 * Formula (v2):
 *   match_score = 0.35 × semantic_similarity
 *               + 0.35 × complementarity       (pure bidirectional, no theme)
 *               + 0.15 × intent_compatibility
 *               + 0.10 × theme_overlap
 *               + 0.05 × freshness_factor
 *
 * Changes from v1:
 *   - Theme overlap is no longer double-counted (was inside complementarity AND here).
 *   - Intent compatibility and freshness are now explicit scoring dimensions.
 *   - Weights shift: semantic+complementarity each 0.35, theme drops to 0.10.
 */
import type { MatchType } from '@/lib/types'
import type { ComplementarityScore } from './complement'
import type { CollaborationType } from './intent'

export const MATCH_THRESHOLD = 0.25   // minimum score to persist a connection
export const MIN_SIMILARITY  = 0.1    // minimum cosine similarity to enter scoring

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Bucketed freshness decay based on wish age.
 *   0–30 days:   1.00
 *   31–90 days:  0.85
 *   91–180 days: 0.65
 *   180+ days:   0.40
 */
export function computeFreshness(createdAt: string | Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const ageDays = (Date.now() - created.getTime()) / MS_PER_DAY
  if (ageDays <= 30)  return 1.00
  if (ageDays <= 90)  return 0.85
  if (ageDays <= 180) return 0.65
  return 0.40
}

export interface MatchScore {
  match_score: number
  match_type: MatchType
  semantic_similarity: number
  complementarity: number
  theme_overlap: number
  intent_compatibility: number
  freshness_factor: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarity: ComplementarityScore,
  intentCompatibility: number,
  freshnessFactor: number
): MatchScore {
  const { score: complementScore, themeOverlap } = complementarity

  const match_score =
    0.35 * semanticSimilarity +
    0.35 * complementScore    +
    0.15 * intentCompatibility +
    0.10 * themeOverlap       +
    0.05 * freshnessFactor

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
    intent_compatibility: intentCompatibility,
    freshness_factor: freshnessFactor,
  }
}

export interface MatchExplanation {
  short_reason: string
  matched_themes: string[]
  matched_canonical_concepts: string[]
  intent_compatibility: number
  freshness_factor: number
}

/**
 * Builds a lightweight explanation for the match — fully deterministic,
 * no LLM call required.
 */
export function buildExplanation(
  score: MatchScore,
  complementarity: ComplementarityScore,
  _intentA: CollaborationType | string,
  _intentB: CollaborationType | string,
  themesA: string[],
  themesB: string[]
): MatchExplanation {
  const sharedThemes = themesA.filter((t) =>
    themesB.some((t2) => t2.toLowerCase().trim() === t.toLowerCase().trim())
  )

  let short_reason: string
  if (score.complementarity > 0.5) {
    short_reason = 'מציע מה שהצד השני צריך'
  } else if (score.theme_overlap > 0.4) {
    short_reason = 'נושאים משותפים חזקים'
  } else if (score.intent_compatibility >= 0.75) {
    short_reason = 'כוונות משלימות'
  } else if (score.match_type === 'RESONANT') {
    short_reason = 'הדהוד עמוק — חלומות ויכולות משלימים ברמה גבוהה'
  } else {
    short_reason = 'שאיפות וערכים דומים'
  }

  return {
    short_reason,
    matched_themes: sharedThemes,
    matched_canonical_concepts: complementarity.matchedConcepts,
    intent_compatibility: score.intent_compatibility,
    freshness_factor: score.freshness_factor,
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
