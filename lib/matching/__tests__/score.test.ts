import { computeMatchScore, MATCH_THRESHOLD } from '../score'

describe('computeMatchScore', () => {
  test('all 1.0 inputs → score 1.0', () => {
    const result = computeMatchScore(1, 1, 1)
    expect(result.match_score).toBeCloseTo(1.0, 5)
  })

  test('all zeros → score 0', () => {
    const result = computeMatchScore(0, 0, 0)
    expect(result.match_score).toBe(0)
  })

  test('classifies "strong" when score ≥ 0.75', () => {
    const result = computeMatchScore(1, 1, 1)
    expect(result.match_type).toBe('strong')
  })

  test('classifies "complementary" when complementarity > 0.5', () => {
    // score = 0.55×0.3 + 0.25×0.8 + 0.20×0 = 0.165 + 0.2 = 0.365
    const result = computeMatchScore(0.3, 0.8, 0)
    expect(result.match_type).toBe('complementary')
  })

  test('classifies "similar" otherwise', () => {
    // score = 0.55×0.4 + 0.25×0.1 + 0.20×0 = 0.22 + 0.025 = 0.245
    const result = computeMatchScore(0.4, 0.1, 0)
    expect(result.match_type).toBe('similar')
  })

  test('MATCH_THRESHOLD is 0.48', () => {
    expect(MATCH_THRESHOLD).toBe(0.48)
  })

  test('score is capped at 1.0', () => {
    const result = computeMatchScore(1, 1, 1)
    expect(result.match_score).toBeLessThanOrEqual(1)
  })

  test('formula weights: 0.55×semantic + 0.25×complementarity + 0.20×structural', () => {
    expect(computeMatchScore(1, 0, 0).match_score).toBeCloseTo(0.55, 5)
    expect(computeMatchScore(0, 1, 0).match_score).toBeCloseTo(0.25, 5)
    expect(computeMatchScore(0, 0, 1).match_score).toBeCloseTo(0.20, 5)
  })

  test('weights sum to 1.0', () => {
    expect(computeMatchScore(1, 1, 1).match_score).toBeCloseTo(1.0, 5)
  })
})
