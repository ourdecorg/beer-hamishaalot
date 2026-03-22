/**
 * Keyword Utilities for Structural Recall & Scoring
 *
 * buildAnchorKeywords — used by the DB-level recall path (find_structured_candidates RPC)
 * computeStructuralSimilarity — used by the scoring pipeline (v8 formula)
 */
import { canonicalize } from './canonicalize'
import type { WishEnrichment } from '@/lib/types'

/**
 * Builds the canonical keyword set for a wish enrichment.
 * Concatenates needs, skills_offered, subject_entities, domain_entities,
 * canonicalizes all terms, and deduplicates.
 * Used to populate wish_enrichment.anchor_keywords for DB &&-overlap queries.
 */
export function buildAnchorKeywords(enrichment: Pick<WishEnrichment,
  'needs' | 'skills_offered' | 'subject_entities' | 'domain_entities'>
): string[] {
  return canonicalize([
    ...(enrichment.needs            ?? []),
    ...(enrichment.skills_offered   ?? []),
    ...(enrichment.subject_entities ?? []),
    ...(enrichment.domain_entities  ?? []),
  ])
}

function norm(s: string): string { return s.toLowerCase().trim() }

function hasOverlap(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false
  const setB = new Set(b.map(norm))
  return a.some(x => setB.has(norm(x)))
}

/**
 * Structural field-level similarity (v8 scoring signal).
 *
 * Checks 5 conditions independently. Score = matching conditions / 4, capped at 1.
 *   +1  A.needs ∩ B.skills_offered  (B offers what A needs — cross-field)
 *   +1  A.skills_offered ∩ B.needs  (A offers what B needs — cross-field)
 *   +1  subject_entities overlap    (same-field, lowercase exact)
 *   +1  domain_entities overlap     (same-field, lowercase exact)
 *   +1  primary_domain match        (same controlled enum value)
 *
 * Uses canonicalize() for needs + skills_offered → handles Hebrew synonyms
 * ("מימון"/"השקעה" both map to 'funding').
 * subject/domain entities use lowercase exact-match (appropriate for named nouns).
 * primary_domain is a controlled enum — always exact.
 */
export function computeStructuralSimilarity(
  a: WishEnrichment,
  b: WishEnrichment,
): number {
  let count = 0

  // Cross-field: A needs what B offers
  if (hasOverlap(canonicalize(a.needs ?? []),          canonicalize(b.skills_offered ?? []))) count++
  // Cross-field: A offers what B needs
  if (hasOverlap(canonicalize(a.skills_offered ?? []), canonicalize(b.needs ?? [])))          count++
  // Same-field entity overlap
  if (hasOverlap(a.subject_entities ?? [],             b.subject_entities ?? []))             count++
  if (hasOverlap(a.domain_entities  ?? [],             b.domain_entities  ?? []))             count++
  // Primary domain match
  if (a.primary_domain && a.primary_domain === b.primary_domain)                              count++

  return Math.min(count / 4, 1)
}
