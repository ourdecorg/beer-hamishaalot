import { computeMatchScore, MATCH_THRESHOLD } from '../score'

describe('computeMatchScore v13 — semantic-only', () => {
  test('score equals semantic similarity', () => {
    expect(computeMatchScore(0.6).match_score).toBeCloseTo(0.6)
  })

  test('score is capped at 1.0', () => {
    expect(computeMatchScore(1).match_score).toBe(1)
  })

  test('zero semantic → zero score', () => {
    expect(computeMatchScore(0).match_score).toBe(0)
  })

  test('classifies "strong" when score >= 0.75', () => {
    expect(computeMatchScore(0.8).match_type).toBe('strong')
    expect(computeMatchScore(0.75).match_type).toBe('strong')
  })

  test('classifies "similar" otherwise', () => {
    expect(computeMatchScore(0.6).match_type).toBe('similar')
    expect(computeMatchScore(0.3).match_type).toBe('similar')
  })

  test('MATCH_THRESHOLD is 0.48', () => {
    expect(MATCH_THRESHOLD).toBe(0.48)
  })
})
