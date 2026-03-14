/**
 * Similarity Search Service
 *
 * Uses pgvector's cosine distance operator (<=>)  via a Supabase RPC function
 * to find the most semantically similar wishes to a given wish.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface SimilarWish {
  wish_id: string
  similarity: number  // cosine similarity in [0, 1], higher = more similar
}

/**
 * Finds the top `limit` most similar wishes to `wishId` by vector cosine similarity.
 * Calls the `match_wishes` Postgres function defined in migration 003.
 *
 * @param wishId         - The source wish ID
 * @param queryEmbedding - Pre-computed embedding for the source wish
 * @param limit          - Max results (default 10)
 */
export async function findSimilarWishes(
  wishId: string,
  queryEmbedding: number[],
  limit = 10
): Promise<SimilarWish[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('match_wishes', {
    query_embedding: queryEmbedding,
    match_wish_id: wishId,
    match_count: limit,
  })

  if (error) throw new Error(`Similarity search failed: ${error.message}`)

  return (data ?? []) as SimilarWish[]
}
