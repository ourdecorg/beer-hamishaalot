/**
 * Connection Enrichment — post-processing stage (v1)
 *
 * Runs after the top-N candidate connections are finalised.
 * For each surviving pair, calls GPT to produce a higher-quality judgment:
 *   - resonance_score          (0–100) — authentic thematic / human resonance
 *   - collaboration_depth_score (0–100) — practical basis for meaningful collaboration
 *   - overall_connection_score  (0–100) — conservative combined score
 *   - confidence                (0–100) — model confidence in its own judgment
 *   - relationship_type         — categorical label
 *   - bilingual opportunity texts for each side
 *
 * Idempotent: a pair already in connection_enrichment is skipped unless forced.
 * Fault-tolerant: failure on one pair is logged and the rest continue.
 *
 * Prompt version: v1
 */

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpenAICall } from './openaiLog'
import type { WishEnrichment } from '@/lib/types'

const PROMPT_VERSION = 'v1'
const MODEL = 'gpt-4o'

// ── Lazy OpenAI singleton ────────────────────────────────────────────────────

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface BilingualText {
  he: string
  en: string
}

export interface ConnectionEnrichmentResult {
  resonance_score: number
  collaboration_depth_score: number
  overall_connection_score: number
  confidence: number
  relationship_type: string
  why: BilingualText
  opportunity_for_wish_a: BilingualText
  opportunity_for_wish_b: BilingualText
  shared_basis: BilingualText
  risks_or_limits: BilingualText
}

const VALID_RELATIONSHIP_TYPES = new Set([
  'high_resonance_strong_collaboration',
  'high_resonance_low_collaboration',
  'moderate_resonance_practical_match',
  'weak_match',
  'unclear',
])

// ── Validation ───────────────────────────────────────────────────────────────

function scoreBetween(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 100
}

function bilingualText(v: unknown): v is BilingualText {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as BilingualText).he === 'string' &&
    typeof (v as BilingualText).en === 'string'
  )
}

function validate(parsed: unknown): ConnectionEnrichmentResult {
  const p = parsed as Record<string, unknown>

  if (!scoreBetween(p.resonance_score))           throw new Error('invalid resonance_score')
  if (!scoreBetween(p.collaboration_depth_score))  throw new Error('invalid collaboration_depth_score')
  if (!scoreBetween(p.overall_connection_score))   throw new Error('invalid overall_connection_score')
  if (!scoreBetween(p.confidence))                 throw new Error('invalid confidence')
  if (!VALID_RELATIONSHIP_TYPES.has(p.relationship_type as string))
    throw new Error(`invalid relationship_type: ${p.relationship_type}`)
  if (!bilingualText(p.why))                       throw new Error('invalid why')
  if (!bilingualText(p.opportunity_for_wish_a))    throw new Error('invalid opportunity_for_wish_a')
  if (!bilingualText(p.opportunity_for_wish_b))    throw new Error('invalid opportunity_for_wish_b')
  if (!bilingualText(p.shared_basis))              throw new Error('invalid shared_basis')
  if (!bilingualText(p.risks_or_limits))           throw new Error('invalid risks_or_limits')

  return {
    resonance_score:           Math.round(p.resonance_score as number),
    collaboration_depth_score: Math.round(p.collaboration_depth_score as number),
    overall_connection_score:  Math.round(p.overall_connection_score as number),
    confidence:                Math.round(p.confidence as number),
    relationship_type:         p.relationship_type as string,
    why:                       p.why as BilingualText,
    opportunity_for_wish_a:    p.opportunity_for_wish_a as BilingualText,
    opportunity_for_wish_b:    p.opportunity_for_wish_b as BilingualText,
    shared_basis:              p.shared_basis as BilingualText,
    risks_or_limits:           p.risks_or_limits as BilingualText,
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

interface WishPayload {
  wish_id: string
  original_text: string
  translation_en: string | null
  enrichment: WishEnrichment | null
}

function buildPrompt(
  a: WishPayload,
  b: WishPayload,
  metrics: { semantic_similarity: number; structural_similarity: number | null; complementarity_score: number },
): string {
  const fmt = (e: WishEnrichment | null) => !e ? '(no enrichment)' : JSON.stringify({
    themes:             e.themes,
    intent:             e.intent,
    needs:              e.needs,
    skills_offered:     e.skills_offered,
    collaboration_type: e.collaboration_type,
    primary_domain:     e.primary_domain,
    subject_entities:   e.subject_entities,
    domain_entities:    e.domain_entities,
  }, null, 2)

  return `You are evaluating whether two wishes represent a genuine connection worth surfacing to their authors.

Be honest and conservative. Reserve high scores for truly meaningful matches.

---
WISH A (id: ${a.wish_id})
Original: ${a.original_text}
English: ${a.translation_en ?? a.original_text}
Structured fields:
${fmt(a.enrichment)}

---
WISH B (id: ${b.wish_id})
Original: ${b.original_text}
English: ${b.translation_en ?? b.original_text}
Structured fields:
${fmt(b.enrichment)}

---
PRE-COMPUTED METRICS (for context — do not copy blindly):
  semantic_similarity (embedding cosine): ${(metrics.semantic_similarity * 100).toFixed(1)}%
  structural_similarity (keyword overlap): ${metrics.structural_similarity != null ? (metrics.structural_similarity * 100).toFixed(1) + '%' : 'n/a'}
  complementarity_score (needs↔skills):   ${(metrics.complementarity_score * 100).toFixed(1)}%

---
SCORING GUIDANCE:
resonance_score (0–100): authentic thematic / human / intentional resonance. Not just "same topic".
collaboration_depth_score (0–100): realistic practical basis for exchange, co-creation, or mutual advancement.
overall_connection_score (0–100): conservative synthesis. Penalise if only one dimension is strong.
confidence (0–100): how certain you are given the information available.

Scale:
  90–100: exceptional — rare, clear deep resonance + strong collaboration basis
  75–89:  strong — worth surfacing prominently
  60–74:  meaningful — promising but not extraordinary
  40–59:  partial — may be interesting, treat carefully
  0–39:   weak, superficial, or unclear

relationship_type — pick exactly one:
  "high_resonance_strong_collaboration"
  "high_resonance_low_collaboration"
  "moderate_resonance_practical_match"
  "weak_match"
  "unclear"

TEXT WRITING RULES:
- opportunity_for_wish_a: tell owner of A what you see in B as a possible opportunity (2–4 sentences)
- opportunity_for_wish_b: tell owner of B what you see in A as a possible opportunity (2–4 sentences)
- why: concise explanation of the core basis for this connection (2–3 sentences)
- shared_basis: what they have in common thematically or practically (1–3 sentences)
- risks_or_limits: honest caveats — what may limit this match (1–2 sentences; write "None identified." if truly none)
- Hebrew: natural to Israeli readers; English: clean and natural
- Warm but not exaggerated. No "perfect match". No mystical language.

Respond ONLY with valid JSON matching this exact schema:
{
  "resonance_score": 0,
  "collaboration_depth_score": 0,
  "overall_connection_score": 0,
  "confidence": 0,
  "relationship_type": "unclear",
  "why": { "he": "", "en": "" },
  "opportunity_for_wish_a": { "he": "", "en": "" },
  "opportunity_for_wish_b": { "he": "", "en": "" },
  "shared_basis": { "he": "", "en": "" },
  "risks_or_limits": { "he": "", "en": "" }
}`
}

// ── Core GPT call ────────────────────────────────────────────────────────────

async function callEnrichment(
  wishAId: string,
  prompt: string,
): Promise<ConnectionEnrichmentResult> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You evaluate pairs of wishes to determine the depth of their connection. ' +
        'You are honest, conservative, and precise. Respond ONLY with valid JSON.',
    },
    { role: 'user', content: prompt },
  ]

  const t0 = Date.now()
  let completion: OpenAI.Chat.ChatCompletion

  try {
    completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages,
    })
    logOpenAICall({
      caller: 'enrichConnection',
      model: MODEL,
      request: { messages, max_completion_tokens: 2048, temperature: 0.2 },
      response: { content: completion.choices[0]?.message?.content, usage: completion.usage },
      elapsedMs: Date.now() - t0,
      wishId: wishAId,
    })
  } catch (err) {
    logOpenAICall({
      caller: 'enrichConnection',
      model: MODEL,
      request: { messages, max_completion_tokens: 2048, temperature: 0.2 },
      error: (err as { message?: string }).message ?? String(err),
      elapsedMs: Date.now() - t0,
      wishId: wishAId,
    })
    throw err
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No valid JSON in enrichment response')

  return validate(JSON.parse(jsonMatch[0]))
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ConnectionPair {
  wish_a_id: string
  wish_b_id: string
  semantic_similarity: number
  structural_similarity: number | null
  complementarity_score: number
}

/**
 * Enriches a single connection pair. Idempotent — skips if already enriched.
 * Retries once on JSON validation failure with a stricter repair prompt.
 */
export async function enrichConnection(
  pair: ConnectionPair,
  wishTexts: Map<string, string>,
  translations: Map<string, string | null>,
  enrichments: Map<string, WishEnrichment>,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const supabase = createAdminClient()
  const { wish_a_id, wish_b_id } = pair

  if (!force) {
    const { data: existing } = await supabase
      .from('connection_enrichment')
      .select('id')
      .eq('wish_a_id', wish_a_id)
      .eq('wish_b_id', wish_b_id)
      .maybeSingle()
    if (existing) {
      console.log(`[ConnectionEnrichment] skipping ${wish_a_id}↔${wish_b_id} — already enriched`)
      return
    }
  }

  console.log(`[ConnectionEnrichment] started ${wish_a_id}↔${wish_b_id}`)

  const aPayload: WishPayload = {
    wish_id:        wish_a_id,
    original_text:  wishTexts.get(wish_a_id) ?? '',
    translation_en: translations.get(wish_a_id) ?? null,
    enrichment:     enrichments.get(wish_a_id) ?? null,
  }
  const bPayload: WishPayload = {
    wish_id:        wish_b_id,
    original_text:  wishTexts.get(wish_b_id) ?? '',
    translation_en: translations.get(wish_b_id) ?? null,
    enrichment:     enrichments.get(wish_b_id) ?? null,
  }

  const prompt = buildPrompt(aPayload, bPayload, {
    semantic_similarity:   pair.semantic_similarity,
    structural_similarity: pair.structural_similarity,
    complementarity_score: pair.complementarity_score,
  })

  let result: ConnectionEnrichmentResult
  try {
    result = await callEnrichment(wish_a_id, prompt)
  } catch (err) {
    // One retry with explicit repair instruction
    console.warn(`[ConnectionEnrichment] first attempt failed for ${wish_a_id}↔${wish_b_id}, retrying once:`, (err as Error).message)
    try {
      result = await callEnrichment(wish_a_id,
        prompt + '\n\nIMPORTANT: Your previous response was invalid. Return ONLY valid JSON. No extra text.')
    } catch (err2) {
      console.error(`[ConnectionEnrichment] failed ${wish_a_id}↔${wish_b_id}:`, (err2 as Error).message)
      return
    }
  }

  const { error } = await supabase
    .from('connection_enrichment')
    .upsert({
      wish_a_id,
      wish_b_id,
      resonance_score:           result.resonance_score,
      collaboration_depth_score: result.collaboration_depth_score,
      overall_connection_score:  result.overall_connection_score,
      confidence:                result.confidence,
      relationship_type:         result.relationship_type,
      why:                       result.why,
      opportunity_for_wish_a:    result.opportunity_for_wish_a,
      opportunity_for_wish_b:    result.opportunity_for_wish_b,
      shared_basis:              result.shared_basis,
      risks_or_limits:           result.risks_or_limits,
      model:                     MODEL,
      prompt_version:            PROMPT_VERSION,
      enriched_at:               new Date().toISOString(),
    }, { onConflict: 'wish_a_id,wish_b_id' })

  if (error) {
    console.error(`[ConnectionEnrichment] DB upsert failed ${wish_a_id}↔${wish_b_id}:`, error.message)
    return
  }

  console.log(`[ConnectionEnrichment] success ${wish_a_id}↔${wish_b_id} — overall=${result.overall_connection_score} type=${result.relationship_type}`)
}

/**
 * Enriches all pairs in the list sequentially.
 * Never throws — logs failures and continues.
 */
export async function enrichConnections(
  pairs: ConnectionPair[],
  wishTexts: Map<string, string>,
  translations: Map<string, string | null>,
  enrichments: Map<string, WishEnrichment>,
): Promise<void> {
  if (pairs.length === 0) return
  console.log(`[ConnectionEnrichment] starting batch of ${pairs.length} pair(s)`)
  for (const pair of pairs) {
    await enrichConnection(pair, wishTexts, translations, enrichments)
  }
  console.log(`[ConnectionEnrichment] batch complete`)
}
