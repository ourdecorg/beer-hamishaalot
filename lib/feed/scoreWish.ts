/**
 * scoreWish
 *
 * Computes a personalised relevance score for a candidate wish.
 *
 * Formula:
 *   relevance = 0.40 × semantic_similarity
 *             + 0.25 × complementarity
 *             + 0.15 × behavioral_signal
 *             + 0.10 × freshness
 *             + 0.10 × quality
 *
 * Reuses computeComplementarity() from the existing matching engine so that
 * scoring logic stays consistent across wish-to-wish matching and feed ranking.
 */
import type { WishEnrichment, WishWithResonance } from '@/lib/types'
import { computeComplementarity } from '@/lib/matching/complement'
import type { UserInterestProfile, ScoredWish } from './types'

/**
 * Exponential time-decay freshness.
 * Score is ~1.0 for brand-new wishes, ~0.5 at 14 days, ~0.05 at 60 days.
 */
function freshnessScore(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.exp(-ageDays / 20)
}

/**
 * Quality proxy from enrichment completeness + community engagement.
 * Range: 0–1.
 * - 0.50 for having AI enrichment
 * - up to 0.50 for resonance count (log-normalised, saturates at ~10)
 */
function qualityScore(wish: WishWithResonance, hasEnrichment: boolean): number {
  const enrichBonus = hasEnrichment ? 0.5 : wish.is_ai_enriched ? 0.25 : 0
  const engBonus = Math.min(0.5, Math.log1p(wish.resonance_count) / Math.log1p(10))
  return enrichBonus + engBonus
}

export function scoreWish(
  wish: WishWithResonance,
  enrichment: WishEnrichment | null,
  /** Cosine similarity from pgvector RPC (0–1), or theme-Jaccard fallback. */
  semanticSim: number,
  profile: UserInterestProfile,
  resonatedIds: Set<string>
): ScoredWish {
  // ── Complementarity ───────────────────────────────────────────────────────
  // Reuse computeComplementarity() by building a pseudo-enrichment from the
  // user's aggregated profile. This scores how well the candidate wish meets
  // what the user can offer (and vice-versa).
  let complementarity = 0
  if (enrichment && (profile.skills.length > 0 || profile.needs.length > 0)) {
    const profileEnrichment: WishEnrichment = {
      wish_id: 'profile',
      themes: profile.themes,
      intent: null,
      needs: profile.needs,
      skills_offered: profile.skills,
      collaboration_type: profile.collaborationTypes[0] ?? null,
      emotional_tone: null,
      analyzed_at: new Date().toISOString(),
    }
    complementarity = computeComplementarity(profileEnrichment, enrichment).score
  }

  // ── Behavioral signal ─────────────────────────────────────────────────────
  // 1.0 if the user has already resonated with this wish (explicit positive signal).
  const behavioral = resonatedIds.has(wish.id) ? 1.0 : 0.0

  const freshness = freshnessScore(wish.created_at)
  const quality = qualityScore(wish, enrichment !== null)

  const relevance_score = Math.min(1,
    0.40 * semanticSim +
    0.25 * complementarity +
    0.15 * behavioral +
    0.10 * freshness +
    0.10 * quality
  )

  return {
    ...wish,
    enrichment,
    relevance_score,
    feed_bucket: 'relevant',   // overwritten by rankWishes
    score_breakdown: { semantic: semanticSim, complementarity, behavioral, freshness, quality },
  }
}
