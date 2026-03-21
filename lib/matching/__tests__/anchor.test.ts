import { computeAnchorOverlap } from '../anchor'

describe('computeAnchorOverlap', () => {
  test('empty arrays → 0', () => {
    expect(computeAnchorOverlap([], [])).toBe(0)
    expect(computeAnchorOverlap(null, ['foo'])).toBe(0)
    expect(computeAnchorOverlap(['foo'], undefined)).toBe(0)
  })

  test('no intersection → 0', () => {
    expect(computeAnchorOverlap(['apple'], ['banana'])).toBe(0)
    expect(computeAnchorOverlap(['a', 'b'], ['c', 'd'])).toBe(0)
  })

  test('intersection=1, min size=1 → 1.0', () => {
    expect(computeAnchorOverlap(['apple'], ['apple', 'banana'])).toBe(1)
    expect(computeAnchorOverlap(['apple'], ['apple'])).toBe(1)
  })

  test('intersection=1, min size>=2 → 0.5', () => {
    expect(computeAnchorOverlap(['apple', 'pear'], ['apple', 'banana'])).toBe(0.5)
  })

  test('intersection>=2 → 1.0', () => {
    expect(computeAnchorOverlap(['apple', 'pear'], ['apple', 'pear', 'grape'])).toBe(1)
    expect(computeAnchorOverlap(['apple', 'pear', 'grape'], ['apple', 'pear'])).toBe(1)
  })

  test('case-insensitive and trims whitespace', () => {
    expect(computeAnchorOverlap(['  Apple '], ['apple'])).toBe(1)
    expect(computeAnchorOverlap(['Apple'], ['APPLE'])).toBe(1)
  })
})
