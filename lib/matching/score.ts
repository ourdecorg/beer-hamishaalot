/**
 * Match Scoring Engine
 *
 * Combines semantic similarity, complementarity, domain match, object alignment,
 * intent compatibility, theme overlap, and freshness into a single match_score.
 *
 * Formula (v4):
 *   match_score = 0.25 × semantic_similarity   (topic-aware embedding since v4)
 *               + 0.20 × complementarity       (bidirectional needs↔skills)
 *               + 0.20 × domain_match          (NEW — primary domain alignment)
 *               + 0.15 × object_alignment      (concrete subject/entity overlap)
 *               + 0.10 × intent_compatibility
 *               + 0.07 × theme_overlap
 *               + 0.03 × freshness_factor
 *
 * Changes from v3:
 *   - domain_match added (0.20) — prevents cross-domain false positives.
 *   - complementarity drops 0.25 → 0.20 to make room.
 *   - object_alignment drops 0.20 → 0.15.
 *   - intent drops 0.15 → 0.10; theme drops 0.10 → 0.07; freshness 0.05 → 0.03.
 *   - Embedding text now includes primary_domain + entities (see embed.ts).
 *
 * Rationale: domain_match acts as a topic gate — two wishes in completely different
 * domains (yoga vs. software startup) receive at most ~0.60 even with perfect
 * complementarity, keeping the threshold at 0.40 meaningful.
 */
import type { MatchType } from '@/lib/types'
import type { ComplementarityScore } from './complement'
import type { CollaborationType } from './intent'
import type { ObjectAlignmentResult } from './objectAlignment'

export const MATCH_THRESHOLD = 0.5    // minimum score to persist a connection
export const MIN_SIMILARITY  = 0.20   // minimum cosine similarity to enter scoring

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
  domain_match: number
  object_alignment: number
  theme_overlap: number
  intent_compatibility: number
  freshness_factor: number
}

export function computeMatchScore(
  semanticSimilarity: number,
  complementarity: ComplementarityScore,
  objectAlignmentScore: number,
  intentCompatibility: number,
  freshnessFactor: number,
  domainMatch: number = 0.5,
  objectRelation: string = 'similar_object'
): MatchScore {
  const { score: complementScore, themeOverlap } = complementarity

  const match_score =
    0.25 * semanticSimilarity  +
    0.20 * complementScore     +
    0.20 * domainMatch         +
    0.15 * objectAlignmentScore +
    0.10 * intentCompatibility +
    0.07 * themeOverlap        +
    0.03 * freshnessFactor

  let match_type: MatchType
  if (match_score >= 0.80) {
    match_type = 'RESONANT'
  } else if (complementScore > 0.60 || objectRelation === 'complementary_object') {
    // 'complementary_object' means objectAlignment already detected a provider↔seeker
    // action pair (find|offer, learn|teach, build|join, etc.) — always label as COMPLEMENTARY.
    match_type = 'COMPLEMENTARY'
  } else {
    match_type = 'SIMILAR'
  }

  return {
    match_score: Math.min(1, match_score),
    match_type,
    semantic_similarity: semanticSimilarity,
    complementarity: complementScore,
    domain_match: domainMatch,
    object_alignment: objectAlignmentScore,
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
  object_alignment_score: number
  object_relation: string
  object_explanation_he: string
}

/**
 * Builds a lightweight explanation for the match — fully deterministic,
 * no LLM call required.
 */
export function buildExplanation(
  score: MatchScore,
  complementarity: ComplementarityScore,
  objectAlignment: ObjectAlignmentResult,
  _intentA: CollaborationType | string,
  _intentB: CollaborationType | string,
  themesA: string[],
  themesB: string[]
): MatchExplanation {
  const sharedThemes = themesA.filter((t) =>
    themesB.some((t2) => t2.toLowerCase().trim() === t.toLowerCase().trim())
  )

  let short_reason: string
  if (objectAlignment.relation === 'same_object') {
    short_reason = objectAlignment.explanationHe
  } else if (objectAlignment.relation === 'complementary_object') {
    short_reason = objectAlignment.explanationHe
  } else if (score.complementarity > 0.5) {
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
    object_alignment_score: score.object_alignment,
    object_relation: objectAlignment.relation,
    object_explanation_he: objectAlignment.explanationHe,
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
