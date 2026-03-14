/**
 * rankWishes
 *
 * Sorts scored wishes and diversifies the final feed to avoid monotony.
 *
 * Target mix:
 *   ~60% relevant      — highest overall relevance_score
 *   ~25% complementary — skill↔need match dominates semantic similarity
 *   ~15% discovery     — fresh wishes from under-represented categories
 *
 * Each wish is assigned to exactly one bucket based on its dominant scoring
 * signal. Slots unfilled by a bucket are backfilled from the sorted pool.
 */
import type { ScoredWish } from './types'

/** Assign a diversification bucket based on the dominant score signal. */
function assignBucket(w: ScoredWish): ScoredWish['feed_bucket'] {
  const { semantic, complementarity, freshness } = w.score_breakdown

  // Complementary-dominant: skill↔need fit is meaningfully stronger than semantic match
  if (complementarity > semantic + 0.15 && complementarity > 0.2) {
    return 'complementary'
  }
  // Discovery: low relevance signals but the wish is recent — show for serendipity
  if (semantic < 0.25 && complementarity < 0.25 && freshness > 0.6) {
    return 'discovery'
  }
  return 'relevant'
}

export function rankWishes(scored: ScoredWish[], limit: number): ScoredWish[] {
  if (scored.length === 0) return []

  // Sort all candidates by relevance descending
  const sorted = [...scored]
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .map(w => ({ ...w, feed_bucket: assignBucket(w) }))

  const targetRelevant = Math.ceil(limit * 0.60)
  const targetComplementary = Math.ceil(limit * 0.25)
  const targetDiscovery = limit - targetRelevant - targetComplementary

  const taken = new Set<string>()
  const result: ScoredWish[] = []

  function take(w: ScoredWish) {
    result.push(w)
    taken.add(w.id)
  }

  // ── Slot 1: relevant ──────────────────────────────────────────────────────
  for (const w of sorted) {
    if (result.length >= targetRelevant) break
    if (w.feed_bucket === 'relevant' && !taken.has(w.id)) take(w)
  }

  // ── Slot 2: complementary — prefer diverse collaboration types ────────────
  const seenCollabTypes = new Set<string>()
  const compPool = sorted.filter(w => w.feed_bucket === 'complementary')

  // First pass: diverse collab types
  for (const w of compPool) {
    if (result.length >= targetRelevant + targetComplementary) break
    const ct = w.enrichment?.collaboration_type ?? null
    if (!taken.has(w.id) && (!ct || !seenCollabTypes.has(ct))) {
      take(w)
      if (ct) seenCollabTypes.add(ct)
    }
  }
  // Backfill if not enough diverse types
  for (const w of compPool) {
    if (result.length >= targetRelevant + targetComplementary) break
    if (!taken.has(w.id)) take(w)
  }

  // ── Slot 3: discovery — freshest untaken wishes ───────────────────────────
  const discoveryPool = sorted
    .filter(w => !taken.has(w.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  for (const w of discoveryPool) {
    if (result.length >= targetRelevant + targetComplementary + targetDiscovery) break
    take({ ...w, feed_bucket: 'discovery' })
  }

  // ── Final backfill: fill any remaining slots from sorted pool ─────────────
  for (const w of sorted) {
    if (result.length >= limit) break
    if (!taken.has(w.id)) take(w)
  }

  return result.slice(0, limit)
}
