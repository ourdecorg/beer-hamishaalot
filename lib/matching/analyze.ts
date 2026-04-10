/**
 * Wish Analysis Service
 *
 * Uses GPT-4o to extract structured collaboration metadata from a wish.
 * Results are stored in the wish_enrichment table.
 */
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpenAICall } from './openaiLog'
import { buildAnchorKeywords } from './keywords'
import type { WishEnrichment } from '@/lib/types'

// Lazy singleton — mirrors the pattern in lib/claude.ts
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

/**
 * Strip characters that cause OpenAI to reject the JSON request body:
 * null bytes, C0/C1 control characters (except \t \n \r).
 */
function sanitizeForApi(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '')
}

/**
 * Retries an async function on 429 (rate limit) errors with backoff.
 * Parses OpenAI's "try again in Xs" message when present; falls back to
 * exponential backoff (1s, 2s, 4s, …).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 429 && attempt < maxRetries - 1) {
        const msg = (err as { message?: string }).message ?? ''
        const matchMs = msg.match(/try again in (\d+)ms/)
        const matchS  = msg.match(/try again in (\d+(?:\.\d+)?)s(?!ec)/)
        const waitMs = matchMs
          ? parseInt(matchMs[1]) + 200
          : matchS
            ? Math.ceil(parseFloat(matchS[1]) * 1000) + 200
            : 1000 * Math.pow(2, attempt)
        console.warn(`[analyze] 429 rate limit — retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('analyzeWishText: max retries exceeded')
}

export interface WishAnalysisResult {
  // English translation of the wish (for cross-lingual embedding)
  translation_en: string
  // Matching fields
  themes: string[]
  intent: string
  needs: string[]
  skills_offered: string[]
  collaboration_type: 'build' | 'learn' | 'connect' | 'support' | 'share'
  subject_entities: string[]
  domain_entities: string[]
  primary_domain: string | null
  // Location (migration 016) — null when no place mentioned
  location_lat: number | null
  location_lng: number | null
  location_name: string | null
  // Date range (migration 016) — null when no time constraint mentioned
  date_range_start: string | null   // ISO YYYY-MM-DD
  date_range_end: string | null     // ISO YYYY-MM-DD
  // Keywords — verbatim/near-verbatim terms from the wish text in original language
  keywords: string[]
  // Anchor entities — max 3 concrete nouns useful for matching (original language)
  anchor_entities: string[]
}

/**
 * Calls GPT-4o to extract structured enrichment from a wish.
 */
export async function analyzeWishText(wishText: string, wishId?: string): Promise<WishAnalysisResult> {
  const model = 'gpt-5.2'
  const today = new Date().toISOString().slice(0, 10)
  const safeText = sanitizeForApi(wishText)
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You analyze wishes and intentions to identify collaboration potential. ' +
        'Extract only information explicitly or strongly implied by the text. ' +
        'Do NOT invent details. Respond ONLY with valid JSON.',
    },
    {
      role: 'user',
      content: `Analyze this wish for collaboration matching:
"${safeText}"

Today's date: ${today}

Return JSON with exactly these fields:
{
  "translation_en": "",
  "themes": [],
  "intent": "",
  "needs": [],
  "skills_offered": [],
  "collaboration_type": "build|learn|connect|support|share",
  "subject_entities": [],
  "domain_entities": [],
  "primary_domain": "health_wellness|technology|entrepreneurship|education|arts_culture|community_social|environment|spirituality|family_parenting|sports_recreation|food_lifestyle|finance|personal_development|professional_career|other",
  "location": {"lat": null, "lng": null, "name": null},
  "date_range": {"start": null, "end": null},
  "keywords": [],
  "anchor_entities": []
}

translation_en:
- Translate the wish into clear, natural English. If the wish is already in English, copy it as-is.

Language rules for free-text fields (themes, needs, skills_offered, domain_entities, keywords, subject_entities, anchor_entities):
- Return in English.

Enum fields (always English): intent, collaboration_type, primary_domain.

Field rules:
- themes: 3-5 concise topic keywords
- intent: short verb phrase describing the goal
- needs: 2-5 explicit needs (what the person lacks or seeks)
- skills_offered: 2-5 explicit contributions (what the person brings)
- subject_entities: 1-3 specific named entities (no abstract concepts)
- domain_entities: 2-5 domain-specific nouns
- keywords: 3-8 important terms verbatim or near-verbatim from the wish text
- anchor_entities: max 3 concrete nouns explicitly mentioned, useful for matching. Empty if none.

Strict rules:
- Do NOT infer skills, location, or time unless explicitly stated
- Prefer empty arrays over guessing

Location (IMPORTANT):
- Fill location.name, location.lat, location.lng if a specific place is explicitly mentioned
- Coordinates: approximate WGS-84 center of the place
- null only when NO explicit place is mentioned

date_range:
- Resolve relative dates using today's date (${today})
- Format: YYYY-MM-DD`,
    },
  ]

  const t0 = Date.now()
  let completion: OpenAI.Chat.ChatCompletion
  try {
    completion = await withRetry(() => getOpenAI().chat.completions.create({
      model,
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
      messages,
    }))
    logOpenAICall({
      caller: 'analyzeWishText',
      model,
      request: { messages, max_completion_tokens: 1024 },
      response: {
        content: completion.choices[0]?.message?.content,
        usage: completion.usage,
      },
      elapsedMs: Date.now() - t0,
      wishId,
    })
  } catch (err) {
    logOpenAICall({
      caller: 'analyzeWishText',
      model,
      request: { messages, max_completion_tokens: 1024 },
      error: (err as { message?: string }).message ?? String(err),
      elapsedMs: Date.now() - t0,
      wishId,
    })
    throw err
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[analyze] raw response (no JSON found):', raw.slice(0, 500))
    throw new Error('No valid JSON in analysis response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  const loc = parsed.location ?? {}
  const dr  = parsed.date_range ?? {}

  return {
    translation_en:   typeof parsed.translation_en === 'string' && parsed.translation_en ? parsed.translation_en : wishText,
    themes:           Array.isArray(parsed.themes)          ? parsed.themes.slice(0, 5)          : [],
    intent:           parsed.intent ?? '',
    needs:            Array.isArray(parsed.needs)           ? parsed.needs.slice(0, 5)           : [],
    skills_offered:   Array.isArray(parsed.skills_offered)  ? parsed.skills_offered.slice(0, 5)  : [],
    collaboration_type: parsed.collaboration_type ?? 'connect',
    subject_entities: Array.isArray(parsed.subject_entities) ? parsed.subject_entities.slice(0, 3) : [],
    domain_entities:  Array.isArray(parsed.domain_entities) ? parsed.domain_entities.slice(0, 5) : [],
    primary_domain:   typeof parsed.primary_domain === 'string' ? parsed.primary_domain : null,
    location_lat:     typeof loc.lat === 'number' ? loc.lat : null,
    location_lng:     typeof loc.lng === 'number' ? loc.lng : null,
    location_name:    typeof loc.name === 'string' && loc.name ? loc.name : null,
    date_range_start: typeof dr.start === 'string' && dr.start ? dr.start : null,
    date_range_end:   typeof dr.end   === 'string' && dr.end   ? dr.end   : null,
    keywords:         Array.isArray(parsed.keywords)        ? parsed.keywords.slice(0, 8)        : [],
    anchor_entities:  Array.isArray(parsed.anchor_entities) ? parsed.anchor_entities.slice(0, 3) : [],
  }
}

/**
 * Analyzes a wish and stores the result in wish_enrichment.
 * Upserts so re-analysis is safe.
 */
export async function analyzeAndStoreWish(
  wishId: string,
  wishText: string,
  { force = false }: { force?: boolean } = {}
): Promise<WishEnrichment> {
  const supabase = createAdminClient()

  // Skip GPT call if enrichment already exists (saves RPD quota during batch re-runs)
  if (!force) {
    const { data: existing } = await supabase
      .from('wish_enrichment')
      .select('*')
      .eq('wish_id', wishId)
      .maybeSingle()
    if (existing) return existing as WishEnrichment
  }

  const result = await analyzeWishText(wishText, wishId)

  const row = {
    wish_id:          wishId,
    translation_en:   result.translation_en,
    themes:           result.themes,
    intent:           result.intent,
    needs:            result.needs,
    skills_offered:   result.skills_offered,
    collaboration_type: result.collaboration_type,
    subject_entities: result.subject_entities,
    domain_entities:  result.domain_entities,
    primary_domain:   result.primary_domain,
    location_lat:     result.location_lat,
    location_lng:     result.location_lng,
    location_name:    result.location_name,
    date_range_start: result.date_range_start,
    date_range_end:   result.date_range_end,
    keywords:         result.keywords,
    anchor_entities:  result.anchor_entities,
    anchor_keywords:  buildAnchorKeywords({
      needs:            result.needs,
      skills_offered:   result.skills_offered,
      subject_entities: result.subject_entities,
      domain_entities:  result.domain_entities,
    }),
    analyzed_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('wish_enrichment')
    .upsert(row, { onConflict: 'wish_id' })

  if (error) throw new Error(`Failed to store wish enrichment: ${error.message}`)

  return row as WishEnrichment
}
