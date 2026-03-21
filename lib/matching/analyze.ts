/**
 * Wish Analysis Service
 *
 * Uses GPT-4o to extract structured collaboration metadata from a wish.
 * Results are stored in the wish_enrichment table.
 */
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpenAICall } from './openaiLog'
import type { WishEnrichment } from '@/lib/types'

// Lazy singleton — mirrors the pattern in lib/claude.ts
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
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
  themes: string[]
  intent: string
  needs: string[]
  skills_offered: string[]
  collaboration_type: 'build' | 'learn' | 'connect' | 'support' | 'share'
  emotional_tone: 'hopeful' | 'urgent' | 'reflective' | 'excited' | 'uncertain'
  // Object-aware fields (migration 012)
  subject_type: string | null
  subject_entities: string[]
  target_action: string | null
  object_of_need: string[]
  constraints: string[]
  domain_entities: string[]
  // Primary domain (migration 013)
  primary_domain: string | null
  // Location (migration 016) — null when no place mentioned
  location_lat: number | null
  location_lng: number | null
  location_name: string | null
  // Date range (migration 016) — null when no time constraint mentioned
  date_range_start: string | null   // ISO YYYY-MM-DD
  date_range_end: string | null     // ISO YYYY-MM-DD
  // Extraction quality signals
  confidence: number        // 0.0–1.0
  ambiguity_flag: boolean   // true if wish is vague/unclear for matching
}

/**
 * Calls GPT-4o to extract structured enrichment from a wish.
 */
export async function analyzeWishText(wishText: string): Promise<WishAnalysisResult> {
  const model = 'gpt-4o'
  const today = new Date().toISOString().slice(0, 10)
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
      content: `Analyze this wish for collaboration potential:
"${wishText}"

Today's date: ${today}

Return JSON:
{
  "themes": [],
  "intent": "",
  "needs": [],
  "skills_offered": [],
  "collaboration_type": "build|learn|connect|support|share",
  "emotional_tone": "hopeful|urgent|reflective|excited|uncertain",
  "subject_type": "community|partner|project|startup|group|event|job|resource|place|knowledge|platform|person|funding|mentor",
  "subject_entities": [],
  "target_action": "build|join|find|offer|learn|teach|fund|support|host|create|collaborate",
  "object_of_need": [],
  "constraints": [],
  "domain_entities": [],
  "primary_domain": "health_wellness|technology|entrepreneurship|education|arts_culture|community_social|environment|spirituality|family_parenting|sports_recreation|food_lifestyle|finance|personal_development|professional_career|other",
  "location": {"lat": null, "lng": null, "name": null},
  "date_range": {"start": null, "end": null},
  "confidence": 0.0,
  "ambiguity_flag": false
}

Language Rules (CRITICAL):
- Detect the original language of the wish.
- ALL free-text fields MUST be returned in the SAME language as the original wish:
  themes, needs, skills_offered, subject_entities, object_of_need, constraints, domain_entities
- DO NOT translate or normalize to English.
- Keep wording natural and concise in the original language.

Enum Fields (always in English):
- intent
- collaboration_type
- emotional_tone
- subject_type
- target_action
- primary_domain

Rules:
- themes: 5-7 concise keywords
- intent: short verb phrase
- needs: 2-5 explicit needs (what the user lacks)
- skills_offered: 2-5 explicit contributions (what the user brings)
- subject_entities: 1-3 concrete, specific entities (no abstractions)
- object_of_need: 1-3 concrete items the user seeks
- constraints: only verifiable constraints (location, time, format, budget)
- domain_entities: 2-5 nouns in original language

Strict interpretation rules:
- Do NOT infer skills if not stated
- Do NOT infer location unless explicitly mentioned
- Do NOT infer time unless explicitly mentioned
- Prefer empty arrays over guessing

Location rules (VERY IMPORTANT):
- If a specific place is explicitly mentioned (city, town, village, neighborhood, country, venue, street+city), you MUST fill:
  - location.name
  - location.lat
  - location.lng
- Coordinates should be approximate WGS-84 coordinates for the center of the mentioned place.
- If multiple places are mentioned, choose the main place most relevant to the wish.
- Use null only if NO explicit place is mentioned at all.
- Do not leave coordinates null when a clear city/town/place is explicitly written.

date_range:
- Resolve relative expressions using today's date
- Format: YYYY-MM-DD

confidence:
- 0.0-1.0 score of extraction confidence

ambiguity_flag:
- true if the wish is vague or unclear for matching
- false otherwise`,
    },
  ]

  const t0 = Date.now()
  let completion: OpenAI.Chat.ChatCompletion
  try {
    completion = await withRetry(() => getOpenAI().chat.completions.create({
      model,
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages,
    }))
    logOpenAICall({
      caller: 'analyzeWishText',
      model,
      request: { messages, max_tokens: 350 },
      response: {
        content: completion.choices[0]?.message?.content,
        usage: completion.usage,
      },
      elapsedMs: Date.now() - t0,
    })
  } catch (err) {
    logOpenAICall({
      caller: 'analyzeWishText',
      model,
      request: { messages, max_tokens: 350 },
      error: (err as { message?: string }).message ?? String(err),
      elapsedMs: Date.now() - t0,
    })
    throw err
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No valid JSON in analysis response')

  const parsed = JSON.parse(jsonMatch[0])

  const loc = parsed.location ?? {}
  const dr  = parsed.date_range ?? {}

  return {
    themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 7) : [],
    intent: parsed.intent ?? '',
    needs: Array.isArray(parsed.needs) ? parsed.needs.slice(0, 5) : [],
    skills_offered: Array.isArray(parsed.skills_offered) ? parsed.skills_offered.slice(0, 5) : [],
    collaboration_type: parsed.collaboration_type ?? 'connect',
    emotional_tone: parsed.emotional_tone ?? 'hopeful',
    subject_type: typeof parsed.subject_type === 'string' ? parsed.subject_type : null,
    subject_entities: Array.isArray(parsed.subject_entities) ? parsed.subject_entities.slice(0, 3) : [],
    target_action: typeof parsed.target_action === 'string' ? parsed.target_action : null,
    object_of_need: Array.isArray(parsed.object_of_need) ? parsed.object_of_need.slice(0, 3) : [],
    constraints: Array.isArray(parsed.constraints) ? parsed.constraints.slice(0, 3) : [],
    domain_entities: Array.isArray(parsed.domain_entities) ? parsed.domain_entities.slice(0, 5) : [],
    primary_domain: typeof parsed.primary_domain === 'string' ? parsed.primary_domain : null,
    location_lat:  typeof loc.lat === 'number' ? loc.lat : null,
    location_lng:  typeof loc.lng === 'number' ? loc.lng : null,
    location_name: typeof loc.name === 'string' && loc.name ? loc.name : null,
    date_range_start: typeof dr.start === 'string' && dr.start ? dr.start : null,
    date_range_end:   typeof dr.end   === 'string' && dr.end   ? dr.end   : null,
    confidence:     typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    ambiguity_flag: parsed.ambiguity_flag === true,
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

  const result = await analyzeWishText(wishText)

  const row = {
    wish_id: wishId,
    themes: result.themes,
    intent: result.intent,
    needs: result.needs,
    skills_offered: result.skills_offered,
    collaboration_type: result.collaboration_type,
    emotional_tone: result.emotional_tone,
    analyzed_at: new Date().toISOString(),
    subject_type: result.subject_type,
    subject_entities: result.subject_entities,
    target_action: result.target_action,
    object_of_need: result.object_of_need,
    constraints: result.constraints,
    domain_entities: result.domain_entities,
    primary_domain: result.primary_domain,
    location_lat: result.location_lat,
    location_lng: result.location_lng,
    location_name: result.location_name,
    date_range_start: result.date_range_start,
    date_range_end: result.date_range_end,
    confidence: result.confidence,
    ambiguity_flag: result.ambiguity_flag,
  }

  const { error } = await supabase
    .from('wish_enrichment')
    .upsert(row, { onConflict: 'wish_id' })

  if (error) throw new Error(`Failed to store wish enrichment: ${error.message}`)

  return row as WishEnrichment
}
