/**
 * Date-range overlap check for wish matching.
 *
 * Rules:
 *   - No start date → wish is valid immediately (today).
 *   - No end date   → wish is valid forever (+∞).
 *   - Partial overlap is sufficient — any shared day counts.
 *   - When neither wish specifies any date, ranges always overlap.
 */

/**
 * Returns true when the two date ranges overlap (inclusive).
 *
 * @param startA ISO date string or null/undefined
 * @param endA   ISO date string or null/undefined
 * @param startB ISO date string or null/undefined
 * @param endB   ISO date string or null/undefined
 */
export function dateRangesOverlap(
  startA: string | null | undefined,
  endA:   string | null | undefined,
  startB: string | null | undefined,
  endB:   string | null | undefined,
): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const FAR_FUTURE = new Date('9999-12-31')

  const sA = startA ? new Date(startA) : today
  const eA = endA   ? new Date(endA)   : FAR_FUTURE
  const sB = startB ? new Date(startB) : today
  const eB = endB   ? new Date(endB)   : FAR_FUTURE

  // Standard interval-overlap test: [sA, eA] ∩ [sB, eB] ≠ ∅
  return sA <= eB && sB <= eA
}
