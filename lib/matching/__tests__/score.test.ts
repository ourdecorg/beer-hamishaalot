import { computeMatchScore, MATCH_THRESHOLD } from '../score'

describe('computeMatchScore', () => {
  test('all 1.0 inputs → score 1.0', () => {
    const result = computeMatchScore(1, 1, 1, 1)
    expect(result.match_score).toBeCloseTo(1.0, 5)
  })

  test('all zeros → score 0', () => {
    const result = computeMatchScore(0, 0, 0, 0)
    expect(result.match_score).toBe(0)
  })

  test('classifies "strong" when score ≥ 0.75', () => {
    const result = computeMatchScore(1, 1, 1, 1)
    expect(result.match_type).toBe('strong')
  })

  test('classifies "complementary" when complementarity > 0.5', () => {
    const result = computeMatchScore(0.3, 0.8, 0.4, 0)
    expect(result.match_type).toBe('complementary')
  })

  test('classifies "similar" otherwise', () => {
    const result = computeMatchScore(0.4, 0.1, 0.4, 0)
    expect(result.match_type).toBe('similar')
  })

  test('MATCH_THRESHOLD is 0.48', () => {
    expect(MATCH_THRESHOLD).toBe(0.48)
  })

  test('score is capped at 1.0', () => {
    const result = computeMatchScore(1, 1, 1, 1)
    expect(result.match_score).toBeLessThanOrEqual(1)
  })

  test('formula weights: 0.45×semantic + 0.25×comp + 0.15×intent + 0.15×keywords', () => {
    const result = computeMatchScore(1, 0, 0, 0)
    expect(result.match_score).toBeCloseTo(0.45, 5)

    const result2 = computeMatchScore(0, 1, 0, 0)
    expect(result2.match_score).toBeCloseTo(0.25, 5)

    const result3 = computeMatchScore(0, 0, 1, 0)
    expect(result3.match_score).toBeCloseTo(0.15, 5)

    const result4 = computeMatchScore(0, 0, 0, 1)
    expect(result4.match_score).toBeCloseTo(0.15, 5)
  })
})
