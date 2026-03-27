/**
 * Embedding Service
 *
 * Generates vector embeddings using OpenAI text-embedding-3-small (1536 dims)
 * and stores them in the wish_embeddings table via pgvector.
 *
 * The embedded text is enriched with structured domain context (primary_domain,
 * domain_entities, intent) so that vector similarity reflects topic proximity,
 * not just surface-level language similarity.
 */
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpenAICall } from './openaiLog'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

/**
 * Builds the text that will be embedded.
 * Appending structured domain fields focuses the vector on the topical "what"
 * of the wish rather than surface phrasing.  All fields are optional so this
 * is safe to call with partial enrichment or none at all.
 */
export function buildEmbeddingText(
  wishText: string,
  enrichment?: {
    primary_domain?: string | null
    themes?: string[]
    domain_entities?: string[]
    subject_entities?: string[]
    intent?: string | null
  }
): string {
  if (!enrichment) return wishText

  const lines: string[] = [wishText]

  if (enrichment.primary_domain) {
    lines.push(`Domain: ${enrichment.primary_domain}`)
  }
  if (enrichment.themes?.length) {
    lines.push(`Themes: ${enrichment.themes.join(', ')}`)
  }
  const entities = [
    ...(enrichment.subject_entities ?? []),
    ...(enrichment.domain_entities ?? []),
  ]
  if (entities.length) {
    lines.push(`Topics: ${entities.join(', ')}`)
  }
  if (enrichment.intent) {
    lines.push(`Intent: ${enrichment.intent}`)
  }

  return lines.join('\n')
}

/**
 * Generates a 1536-dimensional embedding for the given text.
 */
export async function generateEmbedding(text: string, wishId?: string): Promise<number[]> {
  const model = 'text-embedding-3-small'
  const t0 = Date.now()
  let response: OpenAI.Embeddings.CreateEmbeddingResponse
  try {
    response = await getOpenAI().embeddings.create({ model, input: text })
    logOpenAICall({
      caller: 'generateEmbedding',
      model,
      request: { input: text },
      response: { usage: response.usage },  // vector omitted — stored in wish_embeddings
      elapsedMs: Date.now() - t0,
      wishId,
    })
  } catch (err) {
    logOpenAICall({
      caller: 'generateEmbedding',
      model,
      request: { input: text },
      error: (err as { message?: string }).message ?? String(err),
      elapsedMs: Date.now() - t0,
      wishId,
    })
    throw err
  }
  return response.data[0].embedding
}

/**
 * Generates an embedding and stores it in wish_embeddings.
 * Pass enrichment to produce a topic-aware embedding (recommended).
 * Upserts so re-embedding is safe.
 */
async function withDbRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await fn()
    // Supabase returns { error } — if no error, return
    if (!(result as { error?: { message?: string } }).error) return result
    const msg = (result as { error?: { message?: string } }).error?.message ?? ''
    const isTimeout = msg.includes('timeout') || msg.includes('upstream')
    if (isTimeout && attempt < maxRetries - 1) {
      const waitMs = 2000 * (attempt + 1)
      console.warn(`[embed] ${label} timeout — retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      continue
    }
    throw new Error(`${label}: ${msg}`)
  }
  throw new Error(`${label}: max retries exceeded`)
}

export async function generateAndStoreEmbedding(
  wishId: string,
  wishText: string,
  enrichment?: Parameters<typeof buildEmbeddingText>[1],
  { force = false }: { force?: boolean } = {}
): Promise<number[]> {
  const supabase = createAdminClient()

  // Skip generation if embedding already exists (mirrors analyzeAndStoreWish behaviour)
  if (!force) {
    const { data: existing } = await supabase
      .from('wish_embeddings')
      .select('embedding')
      .eq('wish_id', wishId)
      .maybeSingle()
    if (existing?.embedding) return existing.embedding as number[]
  }

  const text = buildEmbeddingText(wishText, enrichment)
  const embedding = await generateEmbedding(text, wishId)

  // Supabase expects the vector as a plain JS array — pgvector handles the cast
  await withDbRetry(
    async () => supabase
      .from('wish_embeddings')
      .upsert(
        { wish_id: wishId, embedding, created_at: new Date().toISOString() },
        { onConflict: 'wish_id' }
      ),
    'Failed to store embedding'
  )

  return embedding
}
