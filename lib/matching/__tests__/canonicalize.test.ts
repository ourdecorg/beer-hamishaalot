import { canonicalize } from '../canonicalize'

describe('canonicalize', () => {
  test('maps exact synonym to canonical ID', () => {
    expect(canonicalize(['funding'])).toEqual(['funding'])
    expect(canonicalize(['investment'])).toEqual(['funding'])
    expect(canonicalize(['seed money'])).toEqual(['funding'])
  })

  test('maps via token match', () => {
    expect(canonicalize(['developer needed'])).toEqual(['technical_build'])
    expect(canonicalize(['marketing strategy'])).toEqual(['audience_growth'])
    expect(canonicalize(['mentor please'])).toEqual(['mentoring'])
  })

  test('falls back to normalized original when no match', () => {
    const result = canonicalize(['xyzunknown'])
    expect(result).toEqual(['xyzunknown'])
  })

  test('deduplicates canonical IDs', () => {
    // "investment" and "funding" should both map to "funding" and deduplicate
    const result = canonicalize(['investment', 'funding', 'capital'])
    expect(result).toEqual(['funding'])
  })

  test('handles empty array', () => {
    expect(canonicalize([])).toEqual([])
  })

  test('canonicalizes multiple distinct concepts', () => {
    const result = canonicalize(['coding', 'marketing', 'mentor'])
    expect(result).toContain('technical_build')
    expect(result).toContain('audience_growth')
    expect(result).toContain('mentoring')
    expect(result.length).toBe(3)
  })

  test('is case-insensitive', () => {
    expect(canonicalize(['FUNDING'])).toEqual(['funding'])
    expect(canonicalize(['Developer'])).toEqual(['technical_build'])
  })
})
