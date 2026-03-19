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
  funding: ['funding', 'investment', 'seed money', 'capital', 'grant', 'investor', 'fundraising', 'finance', 'money', 'מימון', 'השקעה', 'משקיע', 'הון'],
  technical_build: ['technical help', 'developer', 'coding', 'build app', 'engineer', 'software', 'tech', 'programming', 'development', 'cto', 'backend', 'frontend', 'fullstack', 'שותף טכנולוגי', 'מפתח', 'תכנות', 'אפליקציה'],
  audience_growth: ['marketing', 'exposure', 'audience', 'distribution', 'visibility', 'promotion', 'brand', 'reach', 'followers', 'growth', 'social media', 'advertising', 'שיווק', 'חשיפה', 'קהל', 'מותג'],
  mentoring: ['mentor', 'guidance', 'advice', 'coaching', 'feedback', 'review', 'consulting', 'consultant', 'מנטור', 'הדרכה', 'ייעוץ', 'אימון', 'ליווי'],
  design: ['design', 'ux', 'ui', 'visual', 'branding', 'graphics', 'illustration', 'figma', 'product design', 'עיצוב', 'גרפיקה', 'ממשק'],
  content: ['content', 'writing', 'copywriting', 'storytelling', 'blog', 'video', 'podcast', 'editorial', 'media', 'כתיבה', 'תוכן', 'סיפור', 'עריכה'],
  community: ['community', 'network', 'connections', 'relationships', 'people', 'partnerships', 'collaboration', 'ecosystem', 'קהילה', 'רשת', 'קשרים', 'שיתוף פעולה'],
  teaching: ['teaching', 'education', 'training', 'course', 'workshop', 'curriculum', 'instruction', 'pedagogy', 'tutoring', 'הוראה', 'חינוך', 'הדרכה', 'קורס', 'סדנה'],
  data_research: ['data', 'research', 'analysis', 'statistics', 'survey', 'insights', 'analytics', 'machine learning', 'ai', 'science', 'מחקר', 'נתונים', 'ניתוח', 'בינה מלאכותית'],
  operations: ['operations', 'process', 'logistics', 'management', 'coordination', 'project management', 'planning', 'execution', 'ניהול', 'תפעול', 'לוגיסטיקה', 'תכנון'],
  legal_finance: ['legal', 'law', 'accounting', 'compliance', 'contracts', 'regulatory', 'ip', 'patent', 'tax', 'משפט', 'חשבונאות', 'ציות', 'חוזה'],
  sales: ['sales', 'business development', 'biz dev', 'partnerships', 'clients', 'customers', 'revenue', 'deals', 'מכירות', 'פיתוח עסקי', 'לקוחות', 'הכנסות'],
  support: ['support', 'help', 'assistance', 'volunteering', 'nonprofit', 'social impact', 'welfare', 'תמיכה', 'עזרה', 'התנדבות', 'סיוע'],
  // Added from real-world Hebrew wishes (Wishes Test Data 2)
  mental_health: ['mental health', 'therapy', 'psychology', 'wellbeing', 'counseling', 'emotional support', 'mindfulness', 'adhd', 'stress', 'burnout', 'בריאות נפשית', 'פסיכולוגי', 'ייעוץ נפשי', 'תמיכה רגשית', 'רווחה', 'מיינדפולנס', 'שחיקה'],
  parenting: ['parenting', 'childcare', 'family', 'children', 'kids', 'mothers', 'fathers', 'parent', 'הורות', 'ילדים', 'משפחה', 'אמהות', 'אבות', 'הורים', 'גידול ילדים', 'טיפול בילדים'],
  physical_activity: ['sport', 'running', 'fitness', 'exercise', 'hiking', 'yoga', 'workout', 'cycling', 'swim', 'ריצה', 'ספורט', 'כושר', 'יוגה', 'טיולים', 'רכיבה', 'שחייה', 'אימון'],
  creative_arts: ['music', 'art', 'drawing', 'painting', 'photography', 'crafts', 'ceramics', 'theater', 'dance', 'מוזיקה', 'אמנות', 'ציור', 'צילום', 'קרמיקה', 'תיאטרון', 'ריקוד', 'יצירה'],
  language_skills: ['language', 'arabic', 'english', 'translation', 'hebrew', 'conversation', 'שפה', 'ערבית', 'אנגלית', 'תרגום', 'שיחה', 'לשון', 'שפות'],
  book_reading: ['book', 'reading', 'literature', 'library', 'ספר', 'קריאה', 'ספרות', 'ספרייה', 'ספרים', 'ביבליותרפיה'],
  carpooling: ['carpool', 'ride', 'transportation', 'commute', 'ride share', 'נסיעות', 'טרמפ', 'שיתוף רכב', 'נסיעה משותפת', 'נסיעה', 'הסעה'],
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

// ─── Object-aware canonicalization (migration 012) ───────────────────────────

const SUBJECT_TYPE_MAP: Record<string, string[]> = {
  community:      ['community', 'group', 'circle', 'club', 'network', 'קהילה', 'קבוצה', 'מועדון', 'חוג', 'רשת'],
  tech_partner:   ['cofounder', 'co-founder', 'technical partner', 'cto', 'שותף טכנולוגי', 'שותף'],
  funding:        ['investor', 'investment', 'seed', 'capital', 'משקיע', 'מימון', 'השקעה'],
  mentor:         ['mentor', 'advisor', 'guide', 'coach', 'מנטור', 'יועץ', 'מאמן', 'מלווה'],
  project:        ['project', 'startup', 'venture', 'initiative', 'פרויקט', 'סטארטאפ', 'מיזם', 'יוזמה'],
  event:          ['event', 'meetup', 'conference', 'workshop', 'אירוע', 'כנס', 'סדנה', 'מפגש'],
  job:            ['job', 'position', 'role', 'career', 'עבודה', 'תפקיד', 'קריירה'],
  resource:       ['resource', 'tool', 'platform', 'software', 'כלי', 'פלטפורמה', 'משאב'],
  place:          ['place', 'space', 'location', 'venue', 'מקום', 'אולם', 'חלל', 'גינה'],
  knowledge:      ['knowledge', 'information', 'course', 'curriculum', 'ידע', 'מידע', 'קורס'],
  product:        ['product', 'app', 'application', 'מוצר', 'אפליקציה', 'אפ'],
  person:         ['person', 'people', 'someone', 'partner', 'colleague', 'friend', 'אדם', 'אנשים', 'חבר', 'חברה'],
  // Added from real-world Hebrew wishes (Wishes Test Data 2)
  activity_group: ['running group', 'sport group', 'fitness group', 'hiking group', 'קבוצת ריצה', 'קבוצת ספורט', 'קבוצת כושר', 'קבוצת טיולים', 'קבוצת יוגה'],
  support_group:  ['support group', 'therapy group', 'help group', 'mutual aid', 'קבוצת תמיכה', 'קבוצת עזרה', 'קבוצה טיפולית', 'עזרה הדדית'],
  book_club:      ['book club', 'reading group', 'literature group', 'חוג ספרים', 'קבוצת קריאה', 'חוג קריאה', 'ספרייה חברתית'],
  carpool:        ['carpool', 'ride share', 'shared ride', 'שיתוף נסיעה', 'טרמפ', 'נסיעות משותפות', 'קבוצת נסיעה'],
  parents_group:  ['parents group', 'mothers group', 'fathers group', 'parenting group', 'קבוצת הורים', 'קבוצת אמהות', 'קבוצת אבות', 'מעגל הורים'],
}

const ACTION_MAP: Record<string, string[]> = {
  build:       ['build', 'create', 'establish', 'launch', 'develop', 'found', 'start', 'הקים', 'יצר', 'בנה', 'ייסד', 'להקים', 'לבנות', 'לפתח', 'ליצור', 'להשיק'],
  join:        ['join', 'participate', 'be part', 'become member', 'להצטרף', 'להשתתף', 'מצטרף', 'רוצה להצטרף', 'להיות חלק', 'לקחת חלק'],
  find:        ['find', 'looking for', 'seek', 'search', 'need', 'want', 'מחפש', 'מחפשת', 'רוצה', 'צריך', 'מבקש', 'מבקשת', 'מחפשים'],
  offer:       ['offer', 'provide', 'share', 'give', 'contribute', 'מציע', 'מציעה', 'מספק', 'נותן', 'תורם', 'משתף'],
  learn:       ['learn', 'study', 'understand', 'explore', 'לומד', 'ללמוד', 'רוצה ללמוד', 'ללמוד', 'ללמד', 'להבין', 'לחקור'],
  teach:       ['teach', 'train', 'educate', 'instruct', 'guide', 'מלמד', 'מדריך', 'ללמד', 'מנחה', 'להדריך', 'לחנך'],
  fund:        ['fund', 'invest', 'finance', 'back', 'להשקיע', 'לממן', 'לתמוך כלכלית', 'לגייס'],
  support:     ['support', 'help', 'assist', 'volunteer', 'לתמוך', 'לעזור', 'להתנדב', 'לסייע', 'לתת יד'],
  host:        ['host', 'organize', 'run', 'manage', 'לארח', 'לארגן', 'לנהל', 'להנחות', 'לקיים'],
  collaborate: ['collaborate', 'partner', 'work together', 'לשתף פעולה', 'לעבוד ביחד', 'לשתף', 'לפעול יחד'],
  // Added from real-world Hebrew wishes (Wishes Test Data 2)
  connect:     ['connect', 'meet', 'network', 'get to know', 'encounter', 'להכיר', 'לפגוש', 'להתחבר', 'ליצור קשר', 'להיפגש', 'לחבר'],
  share:       ['share experience', 'share story', 'exchange', 'swap', 'לשתף', 'לחלוק', 'להחליף', 'לספר', 'להתוודע'],
  improve:     ['improve', 'upgrade', 'enhance', 'develop myself', 'grow', 'לשפר', 'לפתח את עצמי', 'לצמוח', 'להתפתח', 'לשדרג'],
}

/** Generic map-based canonicalizer for single terms. */
function canonicalizeFromMap(
  raw: string | null | undefined,
  map: Record<string, string[]>
): string | null {
  if (!raw) return null
  const norm = raw.toLowerCase().trim()

  // Build index lazily per call — small maps, fast enough
  for (const [id, synonyms] of Object.entries(map)) {
    for (const syn of synonyms) {
      const synNorm = syn.toLowerCase().trim()
      if (norm === synNorm) return id
      if (norm.includes(synNorm) || synNorm.includes(norm)) return id
    }
  }

  // Token overlap fallback
  const tokens = norm.split(/\s+/).filter((t) => t.length > 2)
  for (const [id, synonyms] of Object.entries(map)) {
    for (const syn of synonyms) {
      const synNorm = syn.toLowerCase().trim()
      if (tokens.some((t) => synNorm.includes(t) || t.includes(synNorm))) return id
    }
  }

  return norm  // no match — normalize only
}

/**
 * Maps a raw subject_type string to a canonical id.
 * Returns null if input is null/undefined.
 */
export function canonicalizeSubjectType(raw: string | null | undefined): string | null {
  return canonicalizeFromMap(raw, SUBJECT_TYPE_MAP)
}

/**
 * Maps a raw target_action string to a canonical id.
 * Returns null if input is null/undefined.
 */
export function canonicalizeAction(raw: string | null | undefined): string | null {
  return canonicalizeFromMap(raw, ACTION_MAP)
}
