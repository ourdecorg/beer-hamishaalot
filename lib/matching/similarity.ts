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

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] ** 2
    normB += b[i] ** 2
  }
  const sim = normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return Number.isFinite(sim) ? Math.max(0, Math.min(1, sim)) : 0
}

function parseVec(raw: unknown): number[] | null {
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as number[])
}

export interface DualSimilarityMaps {
  en:   Map<string, number>   // English-embedding similarity
  orig: Map<string, number>   // original-language embedding similarity
}

/**
 * Computes cosine similarity between query embeddings and stored wish embeddings.
 * Fetches both `embedding` (English) and `embedding_original` in a single DB query.
 * Returns two Maps. Missing or null embeddings are absent from the respective map.
 */
export async function computeSimilaritiesForIds(
  queryEmbeddingEn: number[],
  queryEmbeddingOrig: number[] | null,
  wishIds: string[],
): Promise<DualSimilarityMaps> {
  if (wishIds.length === 0) return { en: new Map(), orig: new Map() }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('wish_embeddings')
    .select('wish_id, embedding, embedding_original')
    .in('wish_id', wishIds)
  if (error) {
    console.warn('[similarity] computeSimilaritiesForIds failed:', error.message)
    return { en: new Map(), orig: new Map() }
  }
  const enMap   = new Map<string, number>()
  const origMap = new Map<string, number>()
  for (const row of data ?? []) {
    const embEn   = parseVec(row.embedding)
    const embOrig = parseVec((row as Record<string, unknown>).embedding_original)
    if (embEn)                          enMap.set(row.wish_id, cosineSim(queryEmbeddingEn, embEn))
    if (embOrig && queryEmbeddingOrig)  origMap.set(row.wish_id, cosineSim(queryEmbeddingOrig, embOrig))
  }
  return { en: enMap, orig: origMap }
}
