/**
 * Complementarity Scoring
 *
 * Computes how complementary two wishes are based on their structured enrichment.
 * No AI call — pure field comparison.
 *
 * Changes from v1:
 *   - Applies semantic canonicalization to needs/skills before scoring,
 *     so "investment" and "funding" are treated as the same concept.
 *   - Theme overlap is NO LONGER included in the complementarity score —
 *     it is returned separately and weighted independently in score.ts.
 *     This prevents double-counting.
 */
import type { WishEnrichment } from '@/lib/types'
import { canonicalize } from './canonicalize'

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

/** Jaccard similarity between two string sets (after normalization). */
function jaccard(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0
  const a = new Set(setA.map(normalize))
  const b = new Set(setB.map(normalize))
  const intersection = Array.from(a).filter((item) => b.has(item)).length
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
  score: number               // 0–1 pure bidirectional needs↔skills (no theme)
  aOffersWhatBNeeds: number   // how well A's skills meet B's needs
  bOffersWhatANeeds: number   // how well B's skills meet A's needs
  themeOverlap: number        // Jaccard of themes (returned for independent weighting)
  canonicalNeedsA: string[]
  canonicalSkillsA: string[]
  canonicalNeedsB: string[]
  canonicalSkillsB: string[]
  matchedConcepts: string[]   // canonical concepts that appear on both sides
}

/**
 * Scores how complementary two wish enrichments are.
 */
export function computeComplementarity(
  a: WishEnrichment,
  b: WishEnrichment
): ComplementarityScore {
  // Canonicalize needs and skills for semantic matching
  const canonNeedsA   = canonicalize(a.needs)
  const canonSkillsA  = canonicalize(a.skills_offered)
  const canonNeedsB   = canonicalize(b.needs)
  const canonSkillsB  = canonicalize(b.skills_offered)

  // Bidirectional needs ↔ skills matching (canonical + soft fallback on originals)
  const aOffersWhatBNeeds = Math.max(
    jaccard(canonSkillsA, canonNeedsB),
    softOverlap(a.skills_offered, b.needs)
  )
  const bOffersWhatANeeds = Math.max(
    jaccard(canonSkillsB, canonNeedsA),
    softOverlap(b.skills_offered, a.needs)
  )

  const themeOverlap = jaccard(a.themes, b.themes)

  // Pure bidirectional score — theme is intentionally excluded here
  // to avoid double-counting with the theme_overlap term in score.ts
  const bidirectional = (aOffersWhatBNeeds + bOffersWhatANeeds) / 2
  const score = Math.min(1, bidirectional * 1.2)

  // Matched concepts: canonical IDs that appear in both (needs or skills) sides
  const allA = new Set([...canonNeedsA, ...canonSkillsA])
  const allB = new Set([...canonNeedsB, ...canonSkillsB])
  const matchedConcepts = Array.from(allA).filter((c) => allB.has(c))

  return {
    score,
    aOffersWhatBNeeds,
    bOffersWhatANeeds,
    themeOverlap,
    canonicalNeedsA: canonNeedsA,
    canonicalSkillsA: canonSkillsA,
    canonicalNeedsB: canonNeedsB,
    canonicalSkillsB: canonSkillsB,
    matchedConcepts,
  }
}
