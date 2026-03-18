import { computeObjectAlignment } from '../objectAlignment'
import type { WishEnrichment } from '@/lib/types'

function makeEnrichment(overrides: Partial<WishEnrichment>): WishEnrichment {
  return {
    wish_id: 'test',
    themes: [],
    intent: null,
    needs: [],
    skills_offered: [],
    collaboration_type: null,
    emotional_tone: null,
    analyzed_at: new Date().toISOString(),
    subject_type: null,
    subject_entities: [],
    target_action: null,
    object_of_need: [],
    constraints: [],
    domain_entities: [],
    ...overrides,
  }
}

describe('computeObjectAlignment', () => {
  // ─── Case 1: same_object ────────────────────────────────────────────────────
  test('same running community in Shoham → same_object with high score', () => {
    // "מחפש שותף להקמת קהילת ריצה בשוהם"
    const a = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קהילת ריצה', 'שוהם'],
      target_action: 'build',
      object_of_need: ['שותף'],
      constraints: ['בשוהם'],
      domain_entities: ['ריצה', 'קהילה', 'מקומי'],
    })
    // "רוצה להקים קבוצת ריצה קהילתית בשוהם"
    const b = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קבוצת ריצה', 'שוהם'],
      target_action: 'build',
      object_of_need: ['שותף'],
      constraints: ['בשוהם'],
      domain_entities: ['ריצה', 'קבוצה', 'קהילתית'],
    })

    const result = computeObjectAlignment(a, b)
    expect(result.relation).toBe('same_object')
    expect(result.score).toBeGreaterThanOrEqual(0.65)
    expect(result.explanationHe).toContain('קהילה')
  })

  // ─── Case 2: complementary_object ──────────────────────────────────────────
  test('builder of AI study group ↔ facilitator looking to join → complementary_object', () => {
    // "מחפשת שותפה להקמת קבוצת לימוד AI לנוער"
    const a = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קבוצת לימוד AI', 'נוער'],
      target_action: 'build',
      object_of_need: ['שותפה'],
      constraints: [],
      domain_entities: ['AI', 'לימוד', 'נוער'],
    })
    // "אני מנחה יזמות ו-AI לנוער ומחפשת קהילה להצטרף אליה"
    const b = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קהילה', 'נוער'],
      target_action: 'join',
      object_of_need: ['קהילה'],
      constraints: [],
      domain_entities: ['AI', 'יזמות', 'נוער'],
    })

    const result = computeObjectAlignment(a, b)
    expect(result.relation).toBe('complementary_object')
    expect(result.explanationHe).toContain('השלמה')
  })

  // ─── Case 3: similar domain, different object ───────────────────────────────
  test('education startup investor ↔ education program mentor → similar_object, not same', () => {
    // "מחפש משקיע לסטארטאפ חינוך"
    const a = makeEnrichment({
      subject_type: 'funding',
      subject_entities: ['סטארטאפ חינוך'],
      target_action: 'find',
      object_of_need: ['משקיע'],
      constraints: [],
      domain_entities: ['חינוך', 'סטארטאפ'],
    })
    // "מחפש מנטור חינוכי לתוכנית נוער"
    const b = makeEnrichment({
      subject_type: 'mentor',
      subject_entities: ['תוכנית נוער'],
      target_action: 'find',
      object_of_need: ['מנטור'],
      constraints: [],
      domain_entities: ['חינוך', 'נוער'],
    })

    const result = computeObjectAlignment(a, b)
    expect(result.relation).not.toBe('same_object')
    expect(['similar_object', 'complementary_object']).toContain(result.relation)
    // Score should be moderate — same domain, different object type
    expect(result.score).toBeGreaterThan(0.2)
    expect(result.score).toBeLessThan(0.75)
    // Breakdown: subjectTypeMatch should be low (funding ≠ mentor)
    expect(result.breakdown.subjectTypeMatch).toBeLessThan(0.5)
  })

  // ─── Case 4: constraint conflict ────────────────────────────────────────────
  test('Jerusalem in-person ↔ North Israel remote → constraintCompatibility low', () => {
    const a = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קהילה'],
      target_action: 'build',
      constraints: ['ירושלים', 'פנים אל פנים'],
      domain_entities: ['קהילה'],
    })
    const b = makeEnrichment({
      subject_type: 'community',
      subject_entities: ['קהילה'],
      target_action: 'build',
      constraints: ['צפון הארץ', 'אונליין'],
      domain_entities: ['קהילה'],
    })

    const result = computeObjectAlignment(a, b)
    expect(result.breakdown.constraintCompatibility).toBeLessThanOrEqual(0.3)
    // Despite same subject_type, constraint conflict should prevent same_object
    expect(result.relation).not.toBe('same_object')
  })

  // ─── Case 5: both pre-migration (all fields missing) → neutral ─────────────
  test('both pre-migration rows → neutral score 0.5', () => {
    const a = makeEnrichment({})  // all object fields empty/null
    const b = makeEnrichment({})

    const result = computeObjectAlignment(a, b)
    expect(result.score).toBe(0.5)
    expect(result.relation).toBe('similar_object')
  })
})
