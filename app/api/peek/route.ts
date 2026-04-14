/**
 * POST /api/peek
 *
 * Public endpoint (no auth required) for the "Peek into the Well" feature.
 * Uses the existing match_wishes() RPC (pgvector HNSW index) so no new
 * migrations are needed. Fetches wish text + enrichment in two follow-up
 * queries, then returns the top 3 semantically resonant wishes.
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

const MIN_LENGTH     = 10
const MAX_LENGTH     = 500
const MIN_SIMILARITY = 0.2
const FETCH_LIMIT    = 20    // candidates from ANN search
const TOP_N          = 3     // results returned to client

// A UUID that will never match a real wish — passed to match_wishes() so it
// doesn't exclude any candidate (the param is meant to skip the source wish).
const DUMMY_WISH_ID = '00000000-0000-0000-0000-000000000000'

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

  // Identify the logged-in user (if any) so we can exclude their own wishes.
  // Non-fatal: if session lookup fails we simply show all wishes.
  let excludeUserId: string | null = null
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    excludeUserId = user?.id ?? null
  } catch {
    // anonymous or cookie error — proceed without exclusion
  }

  // --- Step 1: embed the input (text-embedding-3-small, no GPT) ---
  let embedding: number[]
  try {
    embedding = await generateEmbedding(text)
  } catch (err) {
    console.error('[peek] embedding error:', err)
    return NextResponse.json({ error: 'embedding_failed' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // --- Step 2: ANN search via existing match_wishes() RPC ---
  // DUMMY_WISH_ID is passed as the source wish — it matches nothing, so no
  // candidate is excluded by the "don't match yourself" guard in the RPC.
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

  // Build similarity lookup by wish_id
  const simMap = new Map(allMatches.map(m => [m.wish_id, m.similarity]))
  const allIds = allMatches.map(m => m.wish_id)

  // --- Step 3: fetch wish text, filter by user ---
  let wishQuery = supabase
    .from('wishes')
    .select('id, original_text, user_id')
    .in('id', allIds)
    .eq('visibility', 'open')
    .neq('status', 'cancelled')

  if (excludeUserId) {
    wishQuery = wishQuery.neq('user_id', excludeUserId)
  }

  const { data: wishes, error: wishError } = await wishQuery
  if (wishError) {
    console.error('[peek] wishes fetch error:', wishError.message)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  if (!wishes?.length) {
    return NextResponse.json({ results: [] })
  }

  // --- Step 4: fetch enrichment metadata (emotional_tone, collaboration_type) ---
  const wishIds = wishes.map(w => w.id)
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, emotional_tone, collaboration_type')
    .in('wish_id', wishIds)

  const enrichMap = new Map((enrichments ?? []).map(e => [e.wish_id, e]))

  // --- Step 5: rank by similarity, return top N ---
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
