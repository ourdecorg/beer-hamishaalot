import type { WishEnrichment, WishWithResonance } from '@/lib/types'

/**
 * Aggregated interest profile derived from a user's wish history.
 * Used to score candidate wishes for relevance.
 */
export interface UserInterestProfile {
  /** Number of non-private wishes the user has submitted. */
  wishCount: number
  /** Number of those wishes that have full AI enrichment. */
  enrichedWishCount: number
  /**
   * Component-wise average of the user's wish embeddings.
   * Null when the user has fewer than 1 enriched wish with an embedding.
   */
  interestVector: number[] | null
  themes: string[]
  skills: string[]   // skills_offered across all user wishes
  needs: string[]    // needs expressed across all user wishes
  collaborationTypes: string[]
}

/**
 * A candidate wish augmented with its personalized relevance score and
 * the enrichment data needed for diversification.
 *
 * Extends WishWithResonance so it can be passed directly to WishCard.
 */
export interface ScoredWish extends WishWithResonance {
  relevance_score: number
  /** Which diversification bucket this wish was assigned to. */
  feed_bucket: 'relevant' | 'complementary' | 'discovery'
  /** Per-component scores (useful for debugging; not sent to the client). */
  score_breakdown: {
    semantic: number
    complementarity: number
    behavioral: number
    freshness: number
    quality: number
  }
  /** Enrichment data — kept on the scored wish for diversification logic. */
  enrichment: WishEnrichment | null
}

export interface FeedResult {
  wishes: ScoredWish[]
  /** True when the feed is ranked by the user's personal interest profile. */
  personalized: boolean
  /** Indicates how much history the user has; drives cold-start messaging. */
  profile_strength: 'none' | 'partial' | 'full'
}
