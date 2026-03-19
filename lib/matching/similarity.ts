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
  queryEmbedding: number[]
): Promise<SimilarWish[]> {
  const supabase = createAdminClient()

  return await withSimilarityRetry(async () => {
    const { data, error } = await supabase.rpc('match_wishes', {
      query_embedding: queryEmbedding,
      match_wish_id: wishId,
      min_similarity: MIN_SIMILARITY,
    })
    if (error) throw new Error(`Similarity search failed: ${error.message}`)
    return (data ?? []) as SimilarWish[]
  })
}
