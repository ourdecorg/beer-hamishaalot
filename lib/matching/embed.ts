/**
 * Embedding Service
 *
 * Generates vector embeddings using OpenAI text-embedding-3-small (1536 dims)
 * and stores them in the wish_embeddings table via pgvector.
 */
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

/**
 * Generates a 1536-dimensional embedding for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Generates an embedding and stores it in wish_embeddings.
 * Upserts so re-embedding is safe.
 */
export async function generateAndStoreEmbedding(
  wishId: string,
  wishText: string
): Promise<number[]> {
  const supabase = await createClient()
  const embedding = await generateEmbedding(wishText)

  // Supabase expects the vector as a plain JS array — pgvector handles the cast
  const { error } = await supabase
    .from('wish_embeddings')
    .upsert(
      { wish_id: wishId, embedding, created_at: new Date().toISOString() },
      { onConflict: 'wish_id' }
    )

  if (error) throw new Error(`Failed to store embedding: ${error.message}`)

  return embedding
}
