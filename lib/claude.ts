import OpenAI from 'openai'
import type { EnrichWishResult } from './types'

// Lazy singleton — avoids throwing at module load time during Next.js build
let _openai: OpenAI | null = null
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

export async function enrichWish(wishText: string): Promise<EnrichWishResult> {
  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a compassionate, poetic guide who helps people clarify and deepen their wishes and intentions. You respond with warmth and depth. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: `A person has shared this wish:
"${wishText}"

Please detect the language of the wish and respond entirely in that same language (Hebrew or English).

Provide three things:

1. **Summary** — A poetic, meaningful 2–3 sentence summary that captures the essence and soul of this wish. Write it as if reflecting it back to them with care.

2. **Tags** — 5–7 short thematic tags that capture the core themes, emotions, and domains of this wish (e.g., "growth", "connection", "healing", "creativity").

3. **Intention Statement** — A single, clear sentence that crystallizes the deeper purpose behind this wish, in this structure:
   "I wish to [specific action] so that [desired outcome] because [deeper reason or value]."

Respond ONLY with a valid JSON object:
{
  "ai_summary": "...",
  "ai_tags": ["...", "...", "..."],
  "intention_statement": "..."
}`,
      },
    ],
  })

  const text = completion.choices[0]?.message?.content ?? ''

  // Strip potential markdown code fences
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No valid JSON found in OpenAI response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    ai_summary: parsed.ai_summary ?? parsed.summary ?? '',
    ai_tags: Array.isArray(parsed.ai_tags ?? parsed.tags) ? (parsed.ai_tags ?? parsed.tags) : [],
    intention_statement: parsed.intention_statement ?? parsed.intention ?? '',
  }
}
