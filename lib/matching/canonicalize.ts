/**
 * Semantic Canonicalization
 *
 * Maps raw GPT-extracted phrases (needs / skills_offered) to stable canonical
 * concept IDs so that semantically equivalent labels ("funding", "investment",
 * "seed money") resolve to the same concept before Jaccard comparison.
 *
 * Matching strategy (in order):
 *   1. Exact match after normalization
 *   2. Any synonym token (length > 3) appears in the candidate phrase
 *   3. Fall back to the original normalized term
 */

type CanonicalId = string

const CANONICAL_MAP: Record<CanonicalId, string[]> = {
  funding: ['funding', 'investment', 'seed money', 'capital', 'grant', 'investor', 'fundraising', 'finance', 'money'],
  technical_build: ['technical help', 'developer', 'coding', 'build app', 'engineer', 'software', 'tech', 'programming', 'development', 'cto', 'backend', 'frontend', 'fullstack'],
  audience_growth: ['marketing', 'exposure', 'audience', 'distribution', 'visibility', 'promotion', 'brand', 'reach', 'followers', 'growth', 'social media', 'advertising'],
  mentoring: ['mentor', 'guidance', 'advice', 'coaching', 'feedback', 'review', 'consulting', 'consultant'],
  design: ['design', 'ux', 'ui', 'visual', 'branding', 'graphics', 'illustration', 'figma', 'product design'],
  content: ['content', 'writing', 'copywriting', 'storytelling', 'blog', 'video', 'podcast', 'editorial', 'media'],
  community: ['community', 'network', 'connections', 'relationships', 'people', 'partnerships', 'collaboration', 'ecosystem'],
  teaching: ['teaching', 'education', 'training', 'course', 'workshop', 'curriculum', 'instruction', 'pedagogy', 'tutoring'],
  data_research: ['data', 'research', 'analysis', 'statistics', 'survey', 'insights', 'analytics', 'machine learning', 'ai', 'science'],
  operations: ['operations', 'process', 'logistics', 'management', 'coordination', 'project management', 'planning', 'execution'],
  legal_finance: ['legal', 'law', 'accounting', 'compliance', 'contracts', 'regulatory', 'ip', 'patent', 'tax'],
  sales: ['sales', 'business development', 'biz dev', 'partnerships', 'clients', 'customers', 'revenue', 'deals'],
  support: ['support', 'help', 'assistance', 'volunteering', 'nonprofit', 'social impact', 'welfare'],
}

/** Pre-built lookup: normalized synonym → canonical ID */
const SYNONYM_INDEX = new Map<string, CanonicalId>()

for (const [id, synonyms] of Object.entries(CANONICAL_MAP)) {
  for (const syn of synonyms) {
    SYNONYM_INDEX.set(syn.toLowerCase().trim(), id)
  }
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

/**
 * Maps a single raw term to its canonical ID.
 * Falls back to the normalized term itself if no match is found.
 */
function canonicalizeOne(term: string): CanonicalId {
  const norm = normalize(term)

  // 1. Exact match
  const exact = SYNONYM_INDEX.get(norm)
  if (exact) return exact

  // 2. Token-level match: any synonym token (length > 3) found in the term
  for (const [synonym, id] of SYNONYM_INDEX.entries()) {
    const tokens = synonym.split(/\s+/).filter((t) => t.length > 3)
    if (tokens.length > 0 && tokens.some((t) => norm.includes(t))) return id
  }

  // 3. Reverse: any token from the term found in a synonym phrase
  const termTokens = norm.split(/\s+/).filter((t) => t.length > 3)
  for (const token of termTokens) {
    for (const [synonym, id] of SYNONYM_INDEX.entries()) {
      if (synonym.includes(token)) return id
    }
  }

  return norm  // no match — use as-is
}

/**
 * Canonicalizes an array of raw terms and deduplicates the result.
 */
export function canonicalize(terms: string[]): CanonicalId[] {
  const seen = new Set<CanonicalId>()
  const result: CanonicalId[] = []
  for (const term of terms) {
    const id = canonicalizeOne(term)
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}
