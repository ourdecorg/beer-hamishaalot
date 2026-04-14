/**
 * POST /api/peek
 *
 * Public endpoint (no auth) for the "Peek into the Well" feature.
 * Accepts free text, generates an embedding, and returns the top 3 wishes
 * that resonate semantically with the input.
 *
 * Constraints:
 *   - ONLY uses OpenAI for embeddings (text-embedding-3-small).
 *   - NO LLM / chat-completions calls.
 *   - Ranking is deterministic: score = cosine similarity only.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/matching/embed'

const MIN_LENGTH   = 10
const MAX_LENGTH   = 500
const MIN_SIMILARITY = 0.2
const FETCH_LIMIT  = 10   // candidates fetched from DB
const TOP_N        = 3    // results returned to client

/** Strip control characters that can corrupt JSON bodies sent to OpenAI. */
function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '').trim()
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

  // Identify logged-in user (if any) so we can exclude their own wishes
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const excludeUserId = user?.id ?? null

  // --- Step 1: embed the input (text-embedding-3-small, no GPT) ---
  let embedding: number[]
  try {
    embedding = await generateEmbedding(text)
  } catch (err) {
    console.error('[peek] embedding error:', err)
    return NextResponse.json({ error: 'embedding_failed' }, { status: 500 })
  }

  // --- Step 2: pgvector ANN search via SECURITY DEFINER RPC ---
  // The RPC uses the HNSW index on wish_embeddings.embedding (English cross-lingual).
  // It returns only open, non-cancelled, consented wishes — excluding the
  // current user's own wishes so they always see other people's resonance.
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('peek_wishes', {
    query_embedding:  embedding,
    min_similarity:   MIN_SIMILARITY,
    match_limit:      FETCH_LIMIT,
    exclude_user_id:  excludeUserId,
  })

  if (error) {
    console.error('[peek] RPC error:', error.message)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  // --- Step 3: rank by semantic similarity (sole deterministic signal) ---
  // No LLM boost. emotional_tone / collaboration_type are display metadata only.
  const ranked = ((data ?? []) as {
    wish_id: string
    original_text: string
    similarity: number
    emotional_tone: string | null
    collaboration_type: string | null
  }[])
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_N)

  return NextResponse.json({
    results: ranked.map(r => ({
      wish_id:            r.wish_id,
      text:               r.original_text,
      similarity:         r.similarity,
      emotional_tone:     r.emotional_tone     ?? null,
      collaboration_type: r.collaboration_type ?? null,
    })),
  })
}
