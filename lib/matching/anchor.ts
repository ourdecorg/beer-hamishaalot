/**
 * Anchor Entity Overlap
 *
 * Scores how many concrete anchor entities two wishes share.
 * Deterministic — no AI, no fuzzy matching.
 *
 * Rules:
 *   - Normalize: lowercase + trim
 *   - Exact match only
 *   - Return 0 if either array is empty
 *   - intersection >= 2          → 1.0
 *   - intersection = 1, min = 1  → 1.0  (one side has only that entity — full match)
 *   - intersection = 1, min >= 2 → 0.5  (partial match)
 *   - intersection = 0           → 0.0
 */

export function computeAnchorOverlap(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): number {
  if (!a?.length || !b?.length) return 0

  const normA = new Set(a.map(s => s.toLowerCase().trim()))
  const normB = new Set(b.map(s => s.toLowerCase().trim()))

  const intersection = [...normA].filter(x => normB.has(x)).length

  if (intersection >= 2) return 1
  if (intersection === 1) {
    const minSize = Math.min(normA.size, normB.size)
    return minSize === 1 ? 1 : 0.5
  }
  return 0
}
