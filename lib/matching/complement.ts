/**
 * Complementarity Scoring
 *
 * Computes how complementary two wishes are based on their structured enrichment.
 * No AI call — pure field comparison using Jaccard-like set overlap.
 *
 * Complementarity = bidirectional needs↔skills match:
 *   - Does A need what B offers?
 *   - Does B need what A offers?
 */
import type { WishEnrichment } from '@/lib/types'

/**
 * Normalizes a string for comparison (lowercase, trimmed).
 */
function normalize(s: string): string {
  return s.toLowerCase().trim()
}

/**
 * Jaccard similarity between two string sets (after normalization).
 * Returns 0–1.
 */
function jaccard(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0
  const a = new Set(setA.map(normalize))
  const b = new Set(setB.map(normalize))
  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Soft overlap: counts how many tokens from setA appear as substrings in any element of setB.
 * Handles cases like "technical help" matching "technical skills".
 */
function softOverlap(setA: string[], setB: string[]): number {
  if (setA.length === 0 || setB.length === 0) return 0
  const bNorm = setB.map(normalize).join(' ')
  let matches = 0
  for (const a of setA) {
    const tokens = normalize(a).split(/\s+/)
    if (tokens.some((t) => t.length > 3 && bNorm.includes(t))) matches++
  }
  return matches / setA.length
}

export interface ComplementarityScore {
  score: number           // 0–1 combined complementarity
  aOffersWhatBNeeds: number  // how well A's skills meet B's needs
  bOffersWhatANeeds: number  // how well B's skills meet A's needs
  themeOverlap: number       // Jaccard of themes
}

/**
 * Scores how complementary two wish enrichments are.
 */
export function computeComplementarity(
  a: WishEnrichment,
  b: WishEnrichment
): ComplementarityScore {
  // Bidirectional needs ↔ skills matching
  const aOffersWhatBNeeds = Math.max(
    jaccard(a.skills_offered, b.needs),
    softOverlap(a.skills_offered, b.needs)
  )
  const bOffersWhatANeeds = Math.max(
    jaccard(b.skills_offered, a.needs),
    softOverlap(b.skills_offered, a.needs)
  )

  const themeOverlap = jaccard(a.themes, b.themes)

  // Complementarity is high when at least one direction has strong skill↔need match
  const bidirectional = (aOffersWhatBNeeds + bOffersWhatANeeds) / 2
  const score = Math.min(1, bidirectional * 1.2 + themeOverlap * 0.2)

  return { score, aOffersWhatBNeeds, bOffersWhatANeeds, themeOverlap }
}
