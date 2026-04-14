/**
 * POST /api/peek
 *
 * Public endpoint (no auth required) for the "Peek into the Well" feature.
 * Translates the input to English before embedding so the query vector lives
 * in the same space as the stored English embeddings (translation_en).
 * Uses the existing match_wishes() RPC (pgvector HNSW index).
 */
import { NextResponse, type NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/matching/embed'

const MIN_LENGTH     = 10
const MAX_LENGTH     = 500
const MIN_SIMILARITY = 0.35
const FETCH_LIMIT    = 20   // candidates from ANN search
const TOP_N          = 3    // results returned to client

// A UUID that will never match a real wish — passed to match_wishes() so it
// doesn't exclude any candidate (the param is meant to skip the source wish).
const DUMMY_WISH_ID = '00000000-0000-0000-0000-000000000000'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

/** Strip control characters that can corrupt JSON bodies sent to OpenAI. */
function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '').trim()
}

/**
 * Translate input to English using GPT so the query embedding lives in the
 * same semantic space as the stored English wish embeddings.
 * If the text is already English it is returned unchanged.
 */
async function translateToEnglish(text: string): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content:
          'You are a translator. Translate the user\'s text to English. ' +
          'If it is already in English, return it unchanged. ' +
          'Reply with ONLY the translation — no explanation, no quotes.',
      },
      { role: 'user', content: text },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() || text
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const raw  = typeof body.text === 'string' ? body.text : ''
  const text = sanitize(raw)

  if (text.length < MIN_LENGTH) {
    return NextResponse.json({ error: 'too_short' }, { status: 400 })
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json({ error: 'too_long' }, { status: 400 })
  }

  // --- Step 1: translate to English, then embed ---
  // Wishes are stored with English embeddings (translation_en). Translating
  // the query puts it in the same vector space → higher-quality similarity.
  let embedding: number[]
  try {
    const textEn = await translateToEnglish(text)
    embedding = await generateEmbedding(textEn)
  } catch (err) {
    console.error('[peek] translate/embed error:', err)
    return NextResponse.json({ error: 'embedding_failed' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // --- Step 2: ANN search via existing match_wishes() RPC ---
  const { data: matches, error: matchError } = await supabase.rpc('match_wishes', {
    query_embedding: embedding,
    match_wish_id:   DUMMY_WISH_ID,
    min_similarity:  MIN_SIMILARITY,
    only_lower_id:   false,
  })

  if (matchError) {
    console.error('[peek] match_wishes error:', matchError.message)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  const allMatches = ((matches ?? []) as { wish_id: string; similarity: number }[])
    .sort((a, b) => b.similarity - a.similarity)

  if (allMatches.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const simMap = new Map(allMatches.map(m => [m.wish_id, m.similarity]))
  const allIds = allMatches.map(m => m.wish_id)

  // --- Step 3: fetch wish text ---
  const { data: wishes, error: wishError } = await supabase
    .from('wishes')
    .select('id, original_text')
    .in('id', allIds)
    .eq('visibility', 'open')
    .neq('status', 'cancelled')

  if (wishError) {
    console.error('[peek] wishes fetch error:', wishError.message)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  if (!wishes?.length) {
    return NextResponse.json({ results: [] })
  }

  // --- Step 4: fetch enrichment metadata ---
  const wishIds = wishes.map(w => w.id)
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, emotional_tone, collaboration_type')
    .in('wish_id', wishIds)

  const enrichMap = new Map((enrichments ?? []).map(e => [e.wish_id, e]))

  // --- Step 5: rank by similarity, return top 3 ---
  const ranked = wishes
    .sort((a, b) => (simMap.get(b.id) ?? 0) - (simMap.get(a.id) ?? 0))
    .slice(0, TOP_N)
    .map(w => {
      const enr = enrichMap.get(w.id)
      return {
        wish_id:            w.id,
        text:               w.original_text,
        similarity:         simMap.get(w.id) ?? 0,
        emotional_tone:     enr?.emotional_tone     ?? null,
        collaboration_type: enr?.collaboration_type ?? null,
      }
    })

  return NextResponse.json({ results: ranked })
}
