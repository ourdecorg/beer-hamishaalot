/**
 * buildUserProfile
 *
 * Reads the user's own (non-private) wishes, their AI enrichments, and their
 * stored embeddings to build an aggregated UserInterestProfile.
 *
 * The user's interest vector is the component-wise average of all their wish
 * embeddings — a compact representation of "what this user cares about" that
 * can be used as a query vector in the pgvector similarity search.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserInterestProfile } from './types'

/** Component-wise average of a list of embedding vectors. */
function averageEmbeddings(vectors: number[][]): number[] {
  const dim = vectors[0].length
  const sum = new Array<number>(dim).fill(0)
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += vec[i]
  }
  return sum.map(v => v / vectors.length)
}

export async function buildUserProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<UserInterestProfile> {
  // Only non-private wishes reflect the user's public interests
  const { data: wishes } = await supabase
    .from('wishes')
    .select('id')
    .eq('user_id', userId)
    .in('visibility', ['anonymous', 'open'])

  const wishIds = wishes?.map(w => w.id) ?? []

  if (wishIds.length === 0) {
    return {
      wishCount: 0, enrichedWishCount: 0, interestVector: null,
      themes: [], skills: [], needs: [], collaborationTypes: [],
    }
  }

  // Fetch enrichments and embeddings in parallel.
  // Both are readable for the user's own wishes regardless of RLS.
  const [{ data: enrichments }, { data: embeddings }] = await Promise.all([
    supabase
      .from('wish_enrichment')
      .select('themes, needs, skills_offered, collaboration_type')
      .in('wish_id', wishIds),
    supabase
      .from('wish_embeddings')
      .select('embedding')
      .in('wish_id', wishIds),
  ])

  // Aggregate all themes, skills, and needs from enrichment records
  const themes = new Set<string>()
  const skills = new Set<string>()
  const needs = new Set<string>()
  const collabTypes = new Set<string>()

  for (const e of enrichments ?? []) {
    e.themes?.forEach((t: string) => themes.add(t))
    e.skills_offered?.forEach((s: string) => skills.add(s))
    e.needs?.forEach((n: string) => needs.add(n))
    if (e.collaboration_type) collabTypes.add(e.collaboration_type)
  }

  // Average all available embedding vectors
  const vectors: number[][] = (embeddings ?? [])
    .map(e => e.embedding)
    .filter(Array.isArray)

  const interestVector = vectors.length >= 1 ? averageEmbeddings(vectors) : null

  return {
    wishCount: wishIds.length,
    enrichedWishCount: enrichments?.length ?? 0,
    interestVector,
    themes: Array.from(themes),
    skills: Array.from(skills),
    needs: Array.from(needs),
    collaborationTypes: Array.from(collabTypes),
  }
}
