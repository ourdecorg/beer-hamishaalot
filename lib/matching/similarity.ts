/**
 * Similarity Search Service
 *
 * Uses pgvector's cosine distance operator (<=>)  via a Supabase RPC function
 * to find the most semantically similar wishes to a given wish.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { MIN_SIMILARITY } from './score'

export interface SimilarWish {
  wish_id: string
  similarity: number  // cosine similarity in [0, 1], higher = more similar
}

/**
 * Finds all public wishes similar to `wishId` by vector cosine similarity.
 * Calls the `match_wishes` Postgres function defined in migration 009.
 *
 * @param wishId         - The source wish ID
 * @param queryEmbedding - Pre-computed embedding for the source wish
 */
async function withSimilarityRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? ''
      const isTimeout = msg.includes('timeout') || msg.includes('upstream')
      if (isTimeout && attempt < maxRetries - 1) {
        const waitMs = 2000 * (attempt + 1)  // 2s, 4s
        console.warn(`[similarity] timeout — retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('Similarity search: max retries exceeded')
}

export async function findSimilarWishes(
  wishId: string,
  queryEmbedding: number[],
  { onlyLowerId = false }: { onlyLowerId?: boolean } = {}
): Promise<SimilarWish[]> {
  const supabase = createAdminClient()

  return await withSimilarityRetry(async () => {
    const { data, error } = await supabase.rpc('match_wishes', {
      query_embedding: queryEmbedding,
      match_wish_id: wishId,
      min_similarity: MIN_SIMILARITY,
      only_lower_id: onlyLowerId,
    })
    if (error) throw new Error(`Similarity search failed: ${error.message}`)
    return (data ?? []) as SimilarWish[]
  })
}

export interface StructuredCandidate {
  wish_id: string
}

/**
 * Finds wishes whose anchor_keywords overlap with sourceKeywords via the
 * find_structured_candidates SQL function (array && operator, GIN-indexed).
 * Non-fatal: on failure returns [] and the engine falls back to ANN-only.
 */
export async function findStructuredCandidates(
  wishId: string,
  anchorKeywords: string[],
  { onlyLowerId = false }: { onlyLowerId?: boolean } = {}
): Promise<StructuredCandidate[]> {
  if (anchorKeywords.length === 0) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('find_structured_candidates', {
    source_wish_id:  wishId,
    source_keywords: anchorKeywords,
    only_lower_id:   onlyLowerId,
  })
  if (error) {
    console.warn('[similarity] find_structured_candidates failed:', error.message)
    return []
  }
  return (data ?? []) as StructuredCandidate[]
}

/**
 * Computes cosine similarity between a query embedding and a set of wish embeddings
 * already stored in wish_embeddings. Used to back-fill similarity for structured-only
 * candidates that did not come from the ANN recall path.
 *
 * Returns a Map<wish_id, similarity>. Missing IDs (no embedding) are absent from the map.
 */
export async function computeSimilaritiesForIds(
  queryEmbedding: number[],
  wishIds: string[],
): Promise<Map<string, number>> {
  if (wishIds.length === 0) return new Map()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('wish_embeddings')
    .select('wish_id, embedding')
    .in('wish_id', wishIds)
  if (error) {
    console.warn('[similarity] computeSimilaritiesForIds failed:', error.message)
    return new Map()
  }
  const result = new Map<string, number>()
  for (const row of data ?? []) {
    // Supabase may return pgvector as a JSON string in some configurations
    const emb: number[] = typeof row.embedding === 'string'
      ? JSON.parse(row.embedding)
      : (row.embedding as number[])
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < queryEmbedding.length; i++) {
      dot   += queryEmbedding[i] * emb[i]
      normA += queryEmbedding[i] ** 2
      normB += emb[i] ** 2
    }
    const sim = normA === 0 || normB === 0 ? 0
      : dot / (Math.sqrt(normA) * Math.sqrt(normB))
    result.set(row.wish_id, Number.isFinite(sim) ? Math.max(0, Math.min(1, sim)) : 0)
  }
  return result
}
