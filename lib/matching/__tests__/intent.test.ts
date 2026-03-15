import { computeIntentCompatibility } from '../intent'

describe('computeIntentCompatibility', () => {
  test('learn ↔ support is high (complementary intents)', () => {
    expect(computeIntentCompatibility('learn', 'support')).toBe(0.85)
    expect(computeIntentCompatibility('support', 'learn')).toBe(0.85)  // symmetric
  })

  test('connect ↔ connect is strong', () => {
    expect(computeIntentCompatibility('connect', 'connect')).toBe(0.75)
  })

  test('build ↔ build is moderate', () => {
    expect(computeIntentCompatibility('build', 'build')).toBe(0.60)
  })

  test('share ↔ share is moderate', () => {
    expect(computeIntentCompatibility('share', 'share')).toBe(0.60)
  })

  test('build ↔ share is lower (weak complementarity)', () => {
    const score = computeIntentCompatibility('build', 'share')
    expect(score).toBeLessThan(0.5)
  })

  test('is symmetric for all pairs', () => {
    const types = ['build', 'learn', 'connect', 'support', 'share'] as const
    for (const a of types) {
      for (const b of types) {
        expect(computeIntentCompatibility(a, b)).toBe(computeIntentCompatibility(b, a))
      }
    }
  })

  test('returns fallback for unknown type', () => {
    expect(computeIntentCompatibility('unknown', 'build')).toBe(0.40)
    expect(computeIntentCompatibility('build', 'something_else')).toBe(0.40)
  })

  test('all scores are in 0–1 range', () => {
    const types = ['build', 'learn', 'connect', 'support', 'share'] as const
    for (const a of types) {
      for (const b of types) {
        const score = computeIntentCompatibility(a, b)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    }
  })
})
