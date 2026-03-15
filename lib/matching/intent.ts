/**
 * Intent Compatibility Scoring
 *
 * Uses collaboration_type (build|learn|connect|support|share) to score
 * how well two wishes' intents complement each other.
 *
 * The matrix is asymmetric in spirit but stored symmetrically — we always
 * look up (a, b) and (b, a) returns the same value.
 *
 * Key intuitions:
 *   learn  ↔ support = 0.85  (someone wants to learn, someone offers support/teaching)
 *   connect ↔ connect = 0.75  (both want connections — high fit)
 *   build  ↔ build   = 0.60  (both builders — may collaborate)
 *   share  ↔ connect = 0.65  (sharing to an audience that wants connections)
 *   learn  ↔ learn   = 0.40  (both learning — less direct fit)
 *   build  ↔ share   = 0.30  (low complementarity)
 */

export type CollaborationType = 'build' | 'learn' | 'connect' | 'support' | 'share'

const TYPES: CollaborationType[] = ['build', 'learn', 'connect', 'support', 'share']

// Upper-triangular matrix (including diagonal), indexed as MATRIX[i][j] where i ≤ j
// Rows/cols follow TYPES order above.
const MATRIX: number[][] = [
  //        build  learn  connect  support  share
  /* build */  [0.60, 0.35,  0.40,    0.40,   0.30],
  /* learn */  [     0.40,  0.35,    0.85,   0.50],
  /* connect */[           0.75,    0.40,   0.65],
  /* support */[                    0.40,   0.40],
  /* share */  [                            0.60],
]

const INDEX = new Map<CollaborationType, number>(TYPES.map((t, i) => [t, i]))

const FALLBACK = 0.40

/**
 * Returns a 0–1 compatibility score for two collaboration types.
 * The score is symmetric: f(a, b) === f(b, a).
 */
export function computeIntentCompatibility(
  a: CollaborationType | string,
  b: CollaborationType | string
): number {
  const i = INDEX.get(a as CollaborationType)
  const j = INDEX.get(b as CollaborationType)
  if (i === undefined || j === undefined) return FALLBACK

  // Always use upper triangle
  const row = Math.min(i, j)
  const col = Math.max(i, j)

  // The MATRIX is upper-triangular with diagonal; col offset from row
  return MATRIX[row][col - row]
}
