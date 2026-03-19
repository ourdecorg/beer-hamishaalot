/**
 * Primary Domain Match Scoring (migration 013)
 *
 * Each wish is labelled with a single primary_domain from a 15-value vocabulary.
 * A domain match score captures whether two wishes live in the same conceptual space,
 * preventing cross-domain false positives (e.g. yoga wish ↔ software startup wish).
 *
 * Score values:
 *   1.00 — same domain
 *   0.55–0.70 — closely related domains (commonly overlap in practice)
 *   0.10 — unrelated domains
 *   0.50 — one or both domains are null (neutral — no penalty for old rows)
 */

export type PrimaryDomain =
  | 'health_wellness'
  | 'technology'
  | 'entrepreneurship'
  | 'education'
  | 'arts_culture'
  | 'community_social'
  | 'environment'
  | 'spirituality'
  | 'family_parenting'
  | 'sports_recreation'
  | 'food_lifestyle'
  | 'finance'
  | 'personal_development'
  | 'professional_career'
  | 'other'

// Sorted pair key — always (min, max) alphabetically
function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

// Related-domain partial scores (anything not listed defaults to 0.10)
const RELATED: Record<string, number> = {
  [pairKey('technology',          'entrepreneurship')]:   0.70,
  [pairKey('entrepreneurship',    'finance')]:            0.65,
  [pairKey('entrepreneurship',    'professional_career')]:0.55,
  [pairKey('technology',          'professional_career')]:0.55,
  [pairKey('education',           'personal_development')]:0.65,
  [pairKey('education',           'professional_career')]:0.55,
  [pairKey('health_wellness',     'sports_recreation')]:  0.60,
  [pairKey('health_wellness',     'personal_development')]:0.50,
  [pairKey('health_wellness',     'spirituality')]:       0.45,
  [pairKey('spirituality',        'personal_development')]:0.50,
  [pairKey('arts_culture',        'personal_development')]:0.40,
  [pairKey('arts_culture',        'community_social')]:   0.40,
  [pairKey('community_social',    'environment')]:        0.45,
  [pairKey('community_social',    'family_parenting')]:   0.40,
  [pairKey('food_lifestyle',      'community_social')]:   0.35,
  [pairKey('family_parenting',    'education')]:          0.45,
}

/**
 * Returns a 0–1 score reflecting how topically aligned two domains are.
 * If either domain is null/unknown, returns 0.5 (neutral) to avoid penalising
 * wishes analysed before migration 013.
 */
export function computeDomainMatch(
  domainA: string | null | undefined,
  domainB: string | null | undefined
): number {
  if (!domainA || !domainB) return 0.5   // missing → neutral

  const a = domainA.trim().toLowerCase()
  const b = domainB.trim().toLowerCase()

  if (a === b) return 1.0

  // Both are 'other' — unknown domain, be neutral
  if (a === 'other' && b === 'other') return 0.5
  // One is 'other' — slight nudge down but not a hard rejection
  if (a === 'other' || b === 'other') return 0.3

  return RELATED[pairKey(a, b)] ?? 0.10
}
