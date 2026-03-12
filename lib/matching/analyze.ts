/**
 * Wish Analysis Service
 *
 * Uses GPT-4o to extract structured collaboration metadata from a wish.
 * Results are stored in the wish_enrichment table.
 */
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { WishEnrichment } from '@/lib/types'

// Lazy singleton — mirrors the pattern in lib/claude.ts
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

export interface WishAnalysisResult {
  themes: string[]
  intent: string
  needs: string[]
  skills_offered: string[]
  collaboration_type: 'build' | 'learn' | 'connect' | 'support' | 'share'
  emotional_tone: 'hopeful' | 'urgent' | 'reflective' | 'excited' | 'uncertain'
}

/**
 * Calls GPT-4o to extract structured enrichment from a wish.
 */
export async function analyzeWishText(wishText: string): Promise<WishAnalysisResult> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You analyze wishes and intentions to identify collaboration potential. ' +
          'Respond ONLY with valid JSON. Be concise and specific.',
      },
      {
        role: 'user',
        content: `Analyze this wish for collaboration potential:
"${wishText}"

Respond with this exact JSON shape:
{
  "themes": ["keyword1", "keyword2", ...],      // 5-7 core theme keywords
  "intent": "one sentence: what they want to achieve",
  "needs": ["need1", "need2", ...],             // what they need FROM others (2-5 items)
  "skills_offered": ["skill1", "skill2", ...],  // what THEY can contribute (2-5 items)
  "collaboration_type": "build|learn|connect|support|share",
  "emotional_tone": "hopeful|urgent|reflective|excited|uncertain"
}`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No valid JSON in analysis response')

  const parsed = JSON.parse(jsonMatch[0])

  return {
    themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 7) : [],
    intent: parsed.intent ?? '',
    needs: Array.isArray(parsed.needs) ? parsed.needs.slice(0, 5) : [],
    skills_offered: Array.isArray(parsed.skills_offered) ? parsed.skills_offered.slice(0, 5) : [],
    collaboration_type: parsed.collaboration_type ?? 'connect',
    emotional_tone: parsed.emotional_tone ?? 'hopeful',
  }
}

/**
 * Analyzes a wish and stores the result in wish_enrichment.
 * Upserts so re-analysis is safe.
 */
export async function analyzeAndStoreWish(
  wishId: string,
  wishText: string
): Promise<WishEnrichment> {
  const supabase = await createClient()
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
  }

  const { error } = await supabase
    .from('wish_enrichment')
    .upsert(row, { onConflict: 'wish_id' })

  if (error) throw new Error(`Failed to store wish enrichment: ${error.message}`)

  return row as WishEnrichment
}
