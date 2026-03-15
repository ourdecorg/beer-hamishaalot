import { computeComplementarity } from '../complement'
import type { WishEnrichment } from '@/lib/types'

function makeEnrichment(overrides: Partial<WishEnrichment>): WishEnrichment {
  return {
    wish_id: 'test',
    themes: [],
    intent: '',
    needs: [],
    skills_offered: [],
    collaboration_type: 'connect',
    emotional_tone: 'hopeful',
    analyzed_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeComplementarity', () => {
  test('semantic synonyms are matched via canonicalization', () => {
    const a = makeEnrichment({ needs: ['funding'], skills_offered: [] })
    const b = makeEnrichment({ needs: [], skills_offered: ['investment'] })
    const result = computeComplementarity(a, b)
    // b offers "investment" → canonicalized to "funding", matching a's need
    expect(result.bOffersWhatANeeds).toBeGreaterThan(0)
  })

  test('score does NOT include themeOverlap (no double-count)', () => {
    // Two wishes with identical themes but zero needs/skills overlap
    const a = makeEnrichment({ themes: ['education', 'tech'], needs: [], skills_offered: [] })
    const b = makeEnrichment({ themes: ['education', 'tech'], needs: [], skills_offered: [] })
    const result = computeComplementarity(a, b)
    // themeOverlap should be 1.0 but score should be 0 (no needs/skills match)
    expect(result.themeOverlap).toBeGreaterThan(0.9)
    expect(result.score).toBe(0)  // pure bidirectional with no needs↔skills
  })

  test('matchedConcepts returns shared canonical concepts', () => {
    const a = makeEnrichment({ needs: ['developer'], skills_offered: ['funding'] })
    const b = makeEnrichment({ needs: ['investment'], skills_offered: ['coding'] })
    const result = computeComplementarity(a, b)
    // a needs "developer" → technical_build, b offers "coding" → technical_build → match
    // a offers "funding", b needs "investment" → both funding → match
    expect(result.matchedConcepts).toContain('funding')
    expect(result.matchedConcepts).toContain('technical_build')
  })

  test('perfect bidirectional match gives score near 1', () => {
    const a = makeEnrichment({ needs: ['marketing'], skills_offered: ['coding'] })
    const b = makeEnrichment({ needs: ['developer'], skills_offered: ['marketing strategy'] })
    const result = computeComplementarity(a, b)
    expect(result.score).toBeGreaterThan(0.5)
  })

  test('zero overlap gives score of 0', () => {
    const a = makeEnrichment({ needs: [], skills_offered: [] })
    const b = makeEnrichment({ needs: [], skills_offered: [] })
    const result = computeComplementarity(a, b)
    expect(result.score).toBe(0)
  })

  test('score is always in 0–1 range', () => {
    const a = makeEnrichment({
      needs: ['funding', 'marketing', 'design'],
      skills_offered: ['coding', 'data', 'teaching'],
    })
    const b = makeEnrichment({
      needs: ['coding', 'teaching'],
      skills_offered: ['funding', 'marketing'],
    })
    const result = computeComplementarity(a, b)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })
})
