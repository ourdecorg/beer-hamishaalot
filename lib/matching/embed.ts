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
 * Builds the text that will be embedded for the original-language embedding.
 * Appends structured domain fields to focus the vector on topical "what".
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
 * Builds the English embedding text from the translated wish + enum-only enrichment.
 * All parts are in English, producing a language-agnostic embedding space.
 */
function buildEnglishEmbeddingText(
  translationEn: string,
  enrichment?: {
    primary_domain?: string | null
    intent?: string | null
    collaboration_type?: string | null
  }
): string {
  const lines: string[] = [translationEn]
  if (enrichment?.primary_domain) lines.push(`Domain: ${enrichment.primary_domain}`)
  if (enrichment?.intent)         lines.push(`Intent: ${enrichment.intent}`)
  if (enrichment?.collaboration_type) lines.push(`Collaboration: ${enrichment.collaboration_type}`)
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
  enrichment?: Parameters<typeof buildEmbeddingText>[1] & {
    translation_en?: string | null
    collaboration_type?: string | null
  },
  { force = false }: { force?: boolean } = {}
): Promise<number[]> {
  const supabase = createAdminClient()

  // Skip if both embeddings already exist
  if (!force) {
    const { data: existing } = await supabase
      .from('wish_embeddings')
      .select('embedding, embedding_original')
      .eq('wish_id', wishId)
      .maybeSingle()
    if (existing?.embedding && existing?.embedding_original) {
      const raw = existing.embedding
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as number[]
    }
  }

  const translationEn = enrichment?.translation_en || wishText

  // English embedding (primary) — language-agnostic, used for ANN search
  const enText = buildEnglishEmbeddingText(translationEn, enrichment)
  const embeddingEn = await generateEmbedding(enText, wishId)

  // Original-language embedding — stored for future use
  const origText = buildEmbeddingText(wishText, enrichment)
  const embeddingOrig = await generateEmbedding(origText, wishId)

  await withDbRetry(
    async () => supabase
      .from('wish_embeddings')
      .upsert(
        {
          wish_id:            wishId,
          embedding:          embeddingEn,
          embedding_original: embeddingOrig,
          created_at:         new Date().toISOString(),
        },
        { onConflict: 'wish_id' }
      ),
    'Failed to store embedding'
  )

  return embeddingEn
}
