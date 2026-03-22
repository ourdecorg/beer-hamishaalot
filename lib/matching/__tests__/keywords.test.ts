import { buildAnchorKeywords, computeStructuralSimilarity } from '../keywords'
import type { WishEnrichment } from '@/lib/types'

function makeEnrichment(
  overrides: Partial<Pick<WishEnrichment,
    'needs' | 'skills_offered' | 'subject_entities' | 'domain_entities' | 'primary_domain'>>
): WishEnrichment {
  return {
    wish_id:            'test',
    themes:             [],
    intent:             null,
    needs:              [],
    skills_offered:     [],
    collaboration_type: null,
    emotional_tone:     null,
    analyzed_at:        new Date().toISOString(),
    ...overrides,
  }
}

// ── buildAnchorKeywords ──────────────────────────────────────────────────────

describe('buildAnchorKeywords', () => {
  test('returns empty array for all-empty input', () => {
    expect(buildAnchorKeywords(makeEnrichment({}))).toEqual([])
  })

  test('handles null/undefined fields without throwing', () => {
    expect(() => buildAnchorKeywords({
      needs:            undefined as unknown as string[],
      skills_offered:   null as unknown as string[],
      subject_entities: undefined as unknown as string[],
      domain_entities:  null as unknown as string[],
    })).not.toThrow()
  })

  test('canonicalizes synonyms to same ID', () => {
    const result = buildAnchorKeywords(makeEnrichment({
      needs:          ['funding'],
      skills_offered: ['investment'],  // synonym → same canonical ID
    }))
    expect(result).toContain('funding')
    expect(result.filter(x => x === 'funding').length).toBe(1)  // deduplicated
  })

  test('aggregates across all four fields and deduplicates', () => {
    const result = buildAnchorKeywords(makeEnrichment({
      needs:            ['marketing'],
      skills_offered:   ['marketing'],  // duplicate → appears once
      subject_entities: ['startup'],
      domain_entities:  ['SaaS'],
    }))
    // 'marketing' → 'audience_growth'; deduplicated
    expect(result.filter(x => x === 'audience_growth').length).toBe(1)
    expect(new Set(result).size).toBe(result.length)
  })
})

// ── computeStructuralSimilarity ──────────────────────────────────────────────

describe('computeStructuralSimilarity', () => {
  test('returns 0 for completely unrelated wishes', () => {
    const a = makeEnrichment({ needs: ['funding'], primary_domain: 'technology' })
    const b = makeEnrichment({ needs: ['mentoring'], primary_domain: 'arts_culture' })
    expect(computeStructuralSimilarity(a, b)).toBe(0)
  })

  test('same primary_domain only → 0.25', () => {
    const a = makeEnrichment({ primary_domain: 'technology' })
    const b = makeEnrichment({ primary_domain: 'technology' })
    expect(computeStructuralSimilarity(a, b)).toBeCloseTo(0.25, 5)
  })

  test('A.needs ∩ B.skills_offered → 0.25 (one direction)', () => {
    const a = makeEnrichment({ needs: ['mentoring'] })
    const b = makeEnrichment({ skills_offered: ['mentor'] })   // canonicalize → 'mentoring'
    expect(computeStructuralSimilarity(a, b)).toBeCloseTo(0.25, 5)
  })

  test('bidirectional needs↔skills → 0.50', () => {
    const a = makeEnrichment({ needs: ['funding'], skills_offered: ['mentoring'] })
    const b = makeEnrichment({ needs: ['mentoring'], skills_offered: ['investment'] })
    // A needs funding ↔ B offers investment → +1
    // A offers mentoring ↔ B needs mentoring → +1
    expect(computeStructuralSimilarity(a, b)).toBeCloseTo(0.50, 5)
  })

  test('Hebrew synonyms: מימון/השקעה canonicalize to same concept', () => {
    const a = makeEnrichment({ needs: ['מימון'] })
    const b = makeEnrichment({ skills_offered: ['השקעה'] })
    // Both map to 'funding'
    expect(computeStructuralSimilarity(a, b)).toBeGreaterThan(0)
  })

  test('does NOT count A.needs ∩ B.needs (same-side not cross-field)', () => {
    const a = makeEnrichment({ needs: ['funding'] })
    const b = makeEnrichment({ needs: ['investment'] })  // no skills_offered
    expect(computeStructuralSimilarity(a, b)).toBe(0)
  })

  test('subject_entities overlap → 0.25', () => {
    const a = makeEnrichment({ subject_entities: ['Tel Aviv', 'startup'] })
    const b = makeEnrichment({ subject_entities: ['Startup', 'beer sheva'] })  // case-insensitive
    expect(computeStructuralSimilarity(a, b)).toBeCloseTo(0.25, 5)
  })

  test('score is capped at 1.0 with 4+ matches', () => {
    const a = makeEnrichment({
      needs:            ['funding'],
      skills_offered:   ['mentoring'],
      subject_entities: ['startup'],
      domain_entities:  ['SaaS'],
      primary_domain:   'technology',
    })
    const b = makeEnrichment({
      needs:            ['mentoring'],
      skills_offered:   ['investment'],
      subject_entities: ['startup'],
      domain_entities:  ['SaaS'],
      primary_domain:   'technology',
    })
    expect(computeStructuralSimilarity(a, b)).toBeLessThanOrEqual(1)
    expect(computeStructuralSimilarity(a, b)).toBeGreaterThan(0.75)
  })

  test('null fields do not throw', () => {
    const a = makeEnrichment({})
    const b = makeEnrichment({})
    expect(() => computeStructuralSimilarity(a, b)).not.toThrow()
    expect(computeStructuralSimilarity(a, b)).toBe(0)
  })
})
