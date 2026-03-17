import { computeMatchScore, computeFreshness, buildExplanation, MATCH_THRESHOLD } from '../score'
import type { ComplementarityScore } from '../complement'

function makeComplementarity(overrides: Partial<ComplementarityScore> = {}): ComplementarityScore {
  return {
    score: 0,
    aOffersWhatBNeeds: 0,
    bOffersWhatANeeds: 0,
    themeOverlap: 0,
    canonicalNeedsA: [],
    canonicalSkillsA: [],
    canonicalNeedsB: [],
    canonicalSkillsB: [],
    matchedConcepts: [],
    ...overrides,
  }
}

describe('computeFreshness', () => {
  function daysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString()
  }

  test('0–30 days → 1.0', () => {
    expect(computeFreshness(daysAgo(0))).toBe(1.0)
    expect(computeFreshness(daysAgo(15))).toBe(1.0)
    expect(computeFreshness(daysAgo(30))).toBe(1.0)
  })

  test('31–90 days → 0.85', () => {
    expect(computeFreshness(daysAgo(31))).toBe(0.85)
    expect(computeFreshness(daysAgo(60))).toBe(0.85)
    expect(computeFreshness(daysAgo(90))).toBe(0.85)
  })

  test('91–180 days → 0.65', () => {
    expect(computeFreshness(daysAgo(91))).toBe(0.65)
    expect(computeFreshness(daysAgo(150))).toBe(0.65)
  })

  test('180+ days → 0.40', () => {
    expect(computeFreshness(daysAgo(181))).toBe(0.40)
    expect(computeFreshness(daysAgo(365))).toBe(0.40)
  })

  test('accepts Date object', () => {
    const recent = new Date()
    expect(computeFreshness(recent)).toBe(1.0)
  })
})

describe('computeMatchScore', () => {
  test('weights sum to 1.0 (formula check)', () => {
    // If all inputs are 1.0, score should be 1.0
    const comp = makeComplementarity({ score: 1, themeOverlap: 1 })
    const result = computeMatchScore(1, comp, 1, 1)
    expect(result.match_score).toBeCloseTo(1.0, 5)
  })

  test('all zeros → score 0', () => {
    const comp = makeComplementarity()
    const result = computeMatchScore(0, comp, 0, 0)
    expect(result.match_score).toBe(0)
  })

  test('classifies RESONANT when score ≥ 0.80', () => {
    const comp = makeComplementarity({ score: 1, themeOverlap: 1 })
    const result = computeMatchScore(1, comp, 1, 1)
    expect(result.match_type).toBe('RESONANT')
  })

  test('classifies COMPLEMENTARY when complementarity > 0.60', () => {
    const comp = makeComplementarity({ score: 0.7, themeOverlap: 0 })
    const result = computeMatchScore(0.2, comp, 0.4, 1)
    expect(result.match_type).toBe('COMPLEMENTARY')
  })

  test('classifies SIMILAR otherwise', () => {
    const comp = makeComplementarity({ score: 0.1, themeOverlap: 0.1 })
    const result = computeMatchScore(0.5, comp, 0.4, 1)
    expect(result.match_type).toBe('SIMILAR')
  })

  test('MATCH_THRESHOLD is 0.4', () => {
    expect(MATCH_THRESHOLD).toBe(0.4)
  })

  test('score is capped at 1.0', () => {
    const comp = makeComplementarity({ score: 1, themeOverlap: 1 })
    const result = computeMatchScore(1, comp, 1, 1)
    expect(result.match_score).toBeLessThanOrEqual(1)
  })
})

describe('buildExplanation', () => {
  test('returns "מציע מה שהצד השני צריך" when complementarity > 0.5', () => {
    const score = computeMatchScore(0.5, makeComplementarity({ score: 0.7, themeOverlap: 0 }), 0.4, 1)
    const exp = buildExplanation(score, makeComplementarity({ score: 0.7, matchedConcepts: ['funding'] }), 'build', 'learn', [], [])
    expect(exp.short_reason).toBe('מציע מה שהצד השני צריך')
  })

  test('returns matched_themes correctly', () => {
    const score = computeMatchScore(0.3, makeComplementarity(), 0.4, 1)
    const comp = makeComplementarity({ matchedConcepts: [] })
    const exp = buildExplanation(score, comp, 'build', 'learn', ['education', 'tech'], ['education', 'art'])
    expect(exp.matched_themes).toContain('education')
    expect(exp.matched_themes).not.toContain('art')
  })

  test('includes intent_compatibility and freshness_factor', () => {
    const score = computeMatchScore(0.3, makeComplementarity(), 0.75, 0.85)
    const exp = buildExplanation(score, makeComplementarity(), 'learn', 'support', [], [])
    expect(exp.intent_compatibility).toBe(0.75)
    expect(exp.freshness_factor).toBe(0.85)
  })
})
