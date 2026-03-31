/**
 * Embedding-based Complementarity Scoring (v11)
 *
 * Replaces the keyword/Jaccard-based complement.ts with pairwise cosine similarity
 * between individual need and skill embeddings.
 *
 * Pipeline:
 *   Enrichment time: generateAndStoreTermEmbeddings() — one batch OpenAI call per wish
 *   Scoring time:    loadTermVecsForWishes() — one DB query for all wishes in batch
 *                    computeEmbeddingComplementarity() — pure JS, no DB, no OpenAI
 */

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

const openai = new OpenAI()

// Cosine similarity below this threshold is treated as 0 (noise floor).
const SIMILARITY_THRESHOLD = 0.35

// ── Types ─────────────────────────────────────────────────────────────────────

export type TermType = 'need' | 'skill'

export interface TermVecs {
  needs:  number[][]
  skills: number[][]
}

/** Map from wish_id → pre-loaded term vectors. Built once per batch before scoring loop. */
export type TermVecMap = Map<string, TermVecs>

export interface ComplementarityResult {
  score: number   // final 0–1
  c1:    number   // A needs ← B skills
  c2:    number   // B needs ← A skills
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  const sim = dot / denom
  return Number.isFinite(sim) ? Math.max(0, Math.min(1, sim)) : 0
}

function parseVec(raw: unknown): number[] | null {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as number[])
  } catch {
    return null
  }
}

// ── Enrichment-time: generate + store term embeddings ─────────────────────────

/**
 * Generates embeddings for each individual need and skill_offered of a wish.
 * Uses a single batch OpenAI call for all missing terms.
 * Safe to call multiple times — skips terms already stored.
 */
export async function generateAndStoreTermEmbeddings(
  wishId: string,
  needs: string[],
  skillsOffered: string[],
): Promise<void> {
  // Filter out null/undefined/empty strings defensively — GPT may return dirty arrays
  const cleanNeeds   = needs.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  const cleanSkills  = skillsOffered.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)

  if (cleanNeeds.length === 0 && cleanSkills.length === 0) return

  const admin = createAdminClient()

  // Check which terms are already stored
  const { data: existing } = await admin
    .from('wish_term_embeddings')
    .select('term_type, term_text')
    .eq('wish_id', wishId)

  const existingKeys = new Set(
    (existing ?? []).map((r: { term_type: string; term_text: string }) =>
      `${r.term_type}:${r.term_text}`
    )
  )

  const toEmbed: { text: string; type: TermType }[] = []
  for (const text of cleanNeeds) {
    if (!existingKeys.has(`need:${text}`)) {
      toEmbed.push({ text, type: 'need' })
    }
  }
  for (const text of cleanSkills) {
    if (!existingKeys.has(`skill:${text}`)) {
      toEmbed.push({ text, type: 'skill' })
    }
  }

  if (toEmbed.length === 0) return

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: toEmbed.map(t => t.text),
  })

  const rows = response.data.map((item, i) => ({
    wish_id:   wishId,
    term_type: toEmbed[i].type,
    term_text: toEmbed[i].text,
    embedding: JSON.stringify(item.embedding),
  }))

  // Retry on transient Supabase errors (502, timeout) — safe because rows were pre-checked above
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.from('wish_term_embeddings').insert(rows)
    if (!error) break
    const isTransient = error.message.includes('timeout')
      || error.message.includes('upstream')
      || error.message.includes('502')
      || error.message.includes('Bad gateway')
    if (isTransient && attempt < 2) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      continue
    }
    console.error('[complementEmbed] insert term embeddings failed:', error.message)
    break
  }
}

// ── Batch pre-load (called once before scoring loop) ──────────────────────────

/**
 * Loads all term embeddings for the given wish IDs in a single DB query.
 * Returns a Map from wish_id → { needs: number[][], skills: number[][] }.
 */
export async function loadTermVecsForWishes(wishIds: string[]): Promise<TermVecMap> {
  const map: TermVecMap = new Map()
  if (wishIds.length === 0) return map

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('wish_term_embeddings')
    .select('wish_id, term_type, embedding')
    .in('wish_id', wishIds)

  if (error) {
    console.warn('[complementEmbed] loadTermVecsForWishes failed:', error.message)
    return map
  }

  for (const row of data ?? []) {
    const vec = parseVec(row.embedding)
    if (!vec) continue

    if (!map.has(row.wish_id)) {
      map.set(row.wish_id, { needs: [], skills: [] })
    }
    const entry = map.get(row.wish_id)!
    if (row.term_type === 'need')  entry.needs.push(vec)
    if (row.term_type === 'skill') entry.skills.push(vec)
  }

  return map
}

// ── Runtime scoring (pure JS, no DB, no OpenAI) ───────────────────────────────

/**
 * Computes complementarity from pre-loaded term vectors.
 * Score = max cosine similarity across all valid cross-direction pairs
 * (A.needs vs B.skills and B.needs vs A.skills).
 * Pairs below SIMILARITY_THRESHOLD are ignored. Returns 0 if none qualify.
 */
export function computeEmbeddingComplementarity(
  termVecMap: TermVecMap,
  wishIdA: string,
  wishIdB: string,
): ComplementarityResult {
  const a = termVecMap.get(wishIdA) ?? { needs: [], skills: [] }
  const b = termVecMap.get(wishIdB) ?? { needs: [], skills: [] }

  let best = 0

  for (const needVec of a.needs) {
    for (const skillVec of b.skills) {
      const sim = cosineSim(needVec, skillVec)
      if (sim >= SIMILARITY_THRESHOLD && sim > best) best = sim
    }
  }

  for (const needVec of b.needs) {
    for (const skillVec of a.skills) {
      const sim = cosineSim(needVec, skillVec)
      if (sim >= SIMILARITY_THRESHOLD && sim > best) best = sim
    }
  }

  return { score: best, c1: 0, c2: 0 }
}
