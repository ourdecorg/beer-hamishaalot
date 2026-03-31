import { computeMatchScore, MATCH_THRESHOLD } from '../score'

describe('computeMatchScore', () => {
  test('all 1.0 inputs → score 1.0', () => {
    const result = computeMatchScore(1, 1)
    expect(result.match_score).toBeCloseTo(1.0, 5)
  })

  test('all zeros → score 0', () => {
    const result = computeMatchScore(0, 0)
    expect(result.match_score).toBe(0)
  })

  test('classifies "strong" when score ≥ 0.75', () => {
    const result = computeMatchScore(1, 1)
    expect(result.match_type).toBe('strong')
  })

  test('classifies "complementary" when complementarity > 0.5', () => {
    // score = 0.70×0.3 + 0.30×0.8 = 0.21 + 0.24 = 0.45
    const result = computeMatchScore(0.3, 0.8)
    expect(result.match_type).toBe('complementary')
  })

  test('classifies "similar" otherwise', () => {
    // score = 0.70×0.4 + 0.30×0.1 = 0.28 + 0.03 = 0.31
    const result = computeMatchScore(0.4, 0.1)
    expect(result.match_type).toBe('similar')
  })

  test('MATCH_THRESHOLD is 0.48', () => {
    expect(MATCH_THRESHOLD).toBe(0.48)
  })

  test('score is capped at 1.0', () => {
    const result = computeMatchScore(1, 1)
    expect(result.match_score).toBeLessThanOrEqual(1)
  })

  test('formula weights: 0.70×semantic + 0.30×complementarity', () => {
    expect(computeMatchScore(1, 0).match_score).toBeCloseTo(0.70, 5)
    expect(computeMatchScore(0, 1).match_score).toBeCloseTo(0.30, 5)
  })

  test('weights sum to 1.0', () => {
    expect(computeMatchScore(1, 1).match_score).toBeCloseTo(1.0, 5)
  })
})
