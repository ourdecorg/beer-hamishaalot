/**
 * Object-Aware Alignment Scoring (migration 012)
 *
 * Compares the concrete "objects" of two wishes — what they are about,
 * what action is intended, what entities are mentioned, and what constraints apply.
 *
 * This captures connections that semantic similarity misses, e.g.:
 *   "מחפש שותף לקהילת ריצה בשוהם"  ↔  "רוצה להצטרף לקבוצת ריצה בשוהם"
 *
 * Sub-score weights (sum = 1.0):
 *   0.25 × subjectTypeMatch
 *   0.25 × subjectEntityOverlap
 *   0.20 × targetActionCompatibility
 *   0.15 × objectNeedAlignment
 *   0.10 × domainEntityOverlap
 *   0.05 × constraintCompatibility
 *
 * Missing fields degrade to 0.5 (neutral) so old rows are never penalized.
 */
import type { WishEnrichment } from '@/lib/types'
import { canonicalizeSubjectType, canonicalizeAction } from './canonicalize'

export type ObjectRelation =
  | 'same_object'
  | 'complementary_object'
  | 'similar_object'
  | 'different_object'

export type ObjectAlignmentResult = {
  score: number
  breakdown: {
    subjectTypeMatch: number
    subjectEntityOverlap: number
    targetActionCompatibility: number
    objectNeedAlignment: number
    constraintCompatibility: number
    domainEntityOverlap: number
  }
  relation: ObjectRelation
  explanationHe: string
}

// ─── Action compatibility matrix ─────────────────────────────────────────────
// Symmetric — we always look up (min, max) to avoid storing both directions.

type ActionKey = string
type ActionPair = `${ActionKey}|${ActionKey}`

function actionPairKey(a: string, b: string): ActionPair {
  return (a <= b ? `${a}|${b}` : `${b}|${a}`) as ActionPair
}

const ACTION_COMPAT: Record<ActionPair, number> = {
  'find|offer':        0.95,  // seeker ↔ provider — highly complementary
  'learn|teach':       0.95,  // learner ↔ teacher — highly complementary
  'build|join':        0.80,  // builder ↔ joiner — complementary
  'find|support':      0.75,  // seeker ↔ helper
  'find|teach':        0.75,
  'find|fund':         0.70,  // entrepreneur ↔ investor
  'find|collaborate':  0.70,
  'build|find':        0.60,  // two builders looking for each other
  'build|collaborate': 0.75,
  'build|build':       0.85,  // two builders — strong co-founder signal
  'join|join':         0.65,  // both want to join — moderate
  'offer|support':     0.70,
  'collaborate|collaborate': 0.80,
  'host|join':         0.80,  // organizer ↔ participant
  'host|find':         0.65,
  'learn|support':     0.65,
  'fund|offer':        0.60,
}

const COMPLEMENTARY_PAIRS = new Set<ActionPair>([
  'find|offer',
  'learn|teach',
  'build|join',
  'find|support',
  'find|teach',
  'find|fund',
  'host|join',
])

function actionCompatibility(rawA: string | null | undefined, rawB: string | null | undefined): number {
  const a = canonicalizeAction(rawA)
  const b = canonicalizeAction(rawB)
  if (!a || !b) return 0.5  // neutral when missing
  if (a === b) {
    // Same action — use specific value or generic same-intent score
    return ACTION_COMPAT[actionPairKey(a, b)] ?? 0.70
  }
  return ACTION_COMPAT[actionPairKey(a, b)] ?? 0.40
}

function isComplementaryActionPair(rawA: string | null | undefined, rawB: string | null | undefined): boolean {
  const a = canonicalizeAction(rawA)
  const b = canonicalizeAction(rawB)
  if (!a || !b) return false
  return COMPLEMENTARY_PAIRS.has(actionPairKey(a, b))
}

// ─── Token-level Jaccard helpers ─────────────────────────────────────────────

function tokenize(phrases: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const phrase of phrases) {
    for (const token of phrase.toLowerCase().trim().split(/[\s,،]+/)) {
      if (token.length > 1) tokens.add(token)
    }
  }
  return tokens
}

function tokenJaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0.5  // both empty → neutral
  if (a.length === 0 || b.length === 0) return 0.5  // one missing → neutral
  const tokA = tokenize(a)
  const tokB = tokenize(b)
  let intersection = 0
  for (const t of tokA) { if (tokB.has(t)) intersection++ }
  const union = tokA.size + tokB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Max of two directional soft-overlap scores (A against B, and B against A). */
function crossTokenOverlap(needsA: string[], poolB: string[]): number {
  if (needsA.length === 0 || poolB.length === 0) return 0.5
  const tokB = tokenize(poolB)
  let matches = 0
  for (const phrase of needsA) {
    const tokens = phrase.toLowerCase().trim().split(/[\s,،]+/).filter((t) => t.length > 1)
    if (tokens.some((t) => tokB.has(t))) matches++
  }
  return matches / needsA.length
}

// ─── Constraint compatibility ─────────────────────────────────────────────────

function constraintCompatibility(constraintsA: string[], constraintsB: string[]): number {
  if (constraintsA.length === 0 && constraintsB.length === 0) return 0.5  // neutral
  if (constraintsA.length === 0 || constraintsB.length === 0) return 0.5  // one missing → neutral

  const tokA = tokenize(constraintsA)
  const tokB = tokenize(constraintsB)

  // Check for shared tokens (location match = positive signal)
  let shared = 0
  for (const t of tokA) { if (tokB.has(t)) shared++ }
  if (shared > 0) return 0.80  // shared constraint → compatible

  // Check for explicit mode conflict: online vs. in-person
  const onlineTokens  = new Set(['online', 'אונליין', 'remote', 'zoom', 'virtual', 'דיגיטל'])
  const offlineTokens = new Set(['פנים', 'פיזי', 'in-person', 'face', 'מקומי', 'local'])
  const aOnline  = [...tokA].some((t) => onlineTokens.has(t))
  const aOffline = [...tokA].some((t) => offlineTokens.has(t))
  const bOnline  = [...tokB].some((t) => onlineTokens.has(t))
  const bOffline = [...tokB].some((t) => offlineTokens.has(t))
  if ((aOnline && bOffline) || (aOffline && bOnline)) return 0.20  // explicit conflict

  return 0.45  // different constraints, no clear conflict
}

// ─── Hebrew explanation builder ───────────────────────────────────────────────

const ACTION_LABELS_HE: Record<string, string> = {
  build:       'הקמה',
  join:        'הצטרפות',
  find:        'חיפוש',
  offer:       'הצעה',
  learn:       'למידה',
  teach:       'הוראה',
  fund:        'השקעה',
  support:     'תמיכה',
  host:        'אירגון',
  collaborate: 'שיתוף פעולה',
}

const SUBJECT_TYPE_LABELS_HE: Record<string, string> = {
  community:    'קהילה',
  tech_partner: 'שותף טכנולוגי',
  funding:      'מימון',
  mentor:       'מנטור',
  project:      'פרויקט',
  event:        'אירוע',
  job:          'עבודה',
  resource:     'משאב',
  place:        'מקום',
  knowledge:    'ידע',
  product:      'מוצר',
  person:       'אדם',
}

function buildHeExplanation(
  relation: ObjectRelation,
  canonSubjectType: string | null,
  rawActionA: string | null | undefined,
  rawActionB: string | null | undefined
): string {
  switch (relation) {
    case 'same_object': {
      const typeLabel = canonSubjectType ? (SUBJECT_TYPE_LABELS_HE[canonSubjectType] ?? canonSubjectType) : null
      return typeLabel
        ? `שתי המשאלות עוסקות באותו סוג אובייקט — ${typeLabel}`
        : 'שתי המשאלות עוסקות באותו סוג אובייקט'
    }
    case 'complementary_object': {
      const aLabel = ACTION_LABELS_HE[canonicalizeAction(rawActionA) ?? ''] ?? rawActionA ?? '?'
      const bLabel = ACTION_LABELS_HE[canonicalizeAction(rawActionB) ?? ''] ?? rawActionB ?? '?'
      return `יש כאן השלמה בין מי שמבקש ${aLabel} לבין מי שמבקש ${bLabel}`
    }
    case 'similar_object':
      return 'תחום דומה עם גוון שונה'
    case 'different_object':
    default:
      return 'האובייקטים המרכזיים שונים'
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeObjectAlignment(
  a: WishEnrichment,
  b: WishEnrichment
): ObjectAlignmentResult {
  const allMissing =
    !a.subject_type && !b.subject_type &&
    !a.target_action && !b.target_action &&
    (a.subject_entities ?? []).length === 0 &&
    (b.subject_entities ?? []).length === 0

  if (allMissing) {
    // Both are pre-migration rows — return neutral rather than penalizing
    return {
      score: 0.5,
      breakdown: {
        subjectTypeMatch: 0.5,
        subjectEntityOverlap: 0.5,
        targetActionCompatibility: 0.5,
        objectNeedAlignment: 0.5,
        constraintCompatibility: 0.5,
        domainEntityOverlap: 0.5,
      },
      relation: 'similar_object',
      explanationHe: 'אין מספיק מידע על אובייקט המשאלה',
    }
  }

  // Sub-scores
  const canonStA = canonicalizeSubjectType(a.subject_type)
  const canonStB = canonicalizeSubjectType(b.subject_type)

  let subjectTypeMatch: number
  if (!canonStA || !canonStB) {
    subjectTypeMatch = 0.5  // one missing → neutral
  } else {
    subjectTypeMatch = canonStA === canonStB ? 1.0 : 0.0
  }

  const subjectEntityOverlap = tokenJaccard(
    a.subject_entities ?? [],
    b.subject_entities ?? []
  )

  const targetActionCompatibility = actionCompatibility(a.target_action, b.target_action)

  // objectNeedAlignment: A's need vs B's pool, and vice versa
  const poolB = [...(b.subject_entities ?? []), ...(b.domain_entities ?? [])]
  const poolA = [...(a.subject_entities ?? []), ...(a.domain_entities ?? [])]
  const needAlignAtoB = crossTokenOverlap(a.object_of_need ?? [], poolB)
  const needAlignBtoA = crossTokenOverlap(b.object_of_need ?? [], poolA)
  const objectNeedAlignment = Math.max(needAlignAtoB, needAlignBtoA)

  const domainEntityOverlap = tokenJaccard(
    a.domain_entities ?? [],
    b.domain_entities ?? []
  )

  const constraintScore = constraintCompatibility(
    a.constraints ?? [],
    b.constraints ?? []
  )

  // Weighted combination
  const score = Math.min(1,
    0.25 * subjectTypeMatch         +
    0.25 * subjectEntityOverlap     +
    0.20 * targetActionCompatibility +
    0.15 * objectNeedAlignment      +
    0.10 * domainEntityOverlap      +
    0.05 * constraintScore
  )

  // Determine relation
  let relation: ObjectRelation
  if (subjectTypeMatch >= 0.7 && subjectEntityOverlap >= 0.3) {
    relation = 'same_object'
  } else if (isComplementaryActionPair(a.target_action, b.target_action) && score >= 0.35) {
    relation = 'complementary_object'
  } else if (score >= 0.3) {
    relation = 'similar_object'
  } else {
    relation = 'different_object'
  }

  const explanationHe = buildHeExplanation(
    relation,
    canonStA ?? canonStB,
    a.target_action,
    b.target_action
  )

  return {
    score: Math.round(score * 1000) / 1000,
    breakdown: {
      subjectTypeMatch:           Math.round(subjectTypeMatch          * 1000) / 1000,
      subjectEntityOverlap:       Math.round(subjectEntityOverlap      * 1000) / 1000,
      targetActionCompatibility:  Math.round(targetActionCompatibility * 1000) / 1000,
      objectNeedAlignment:        Math.round(objectNeedAlignment       * 1000) / 1000,
      constraintCompatibility:    Math.round(constraintScore           * 1000) / 1000,
      domainEntityOverlap:        Math.round(domainEntityOverlap       * 1000) / 1000,
    },
    relation,
    explanationHe,
  }
}
