// ============================================================
// באר המשאלות — Core Domain Types
// ============================================================

export type WishVisibility = 'open'

export interface Wish {
  id: string
  user_id: string
  original_text: string
  visibility: WishVisibility
  created_at: string
  updated_at: string
  user_email: string | null
  consent_to_match_sharing?: boolean
}

export interface WishWithResonance extends Wish {
  resonance_count: number
  user_has_resonated: boolean
}

export interface WishResonance {
  id: string
  wish_id: string
  user_id: string
  created_at: string
}

export interface Collaboration {
  id: string
  wish_id: string
  collaborator_id: string
  role: 'collaborator' | 'advisor'
  status: 'pending' | 'accepted' | 'declined'
  message: string | null
  created_at: string
}

// Contact info collected in the wish form (stored to user_profiles, not to the wish)
export interface WishContactInfo {
  contact_name: string
  contact_country: string
  contact_city: string
  contact_phone?: string
}

// API request/response shapes
export interface CreateWishInput {
  original_text: string
  visibility: WishVisibility
  contact?: WishContactInfo
  consent_to_match_sharing?: boolean
}

export interface ApiError {
  error: string
  code?: string
}

// ============================================================
// Resonance Engine Types
// ============================================================

export interface WishEnrichment {
  wish_id: string
  analyzed_at: string
  // English translation (migration 034) — used for cross-lingual English embedding.
  translation_en?: string | null
  // Matching fields
  themes: string[]
  intent: string | null
  needs: string[]
  skills_offered: string[]
  collaboration_type: string | null
  subject_entities?: string[]
  domain_entities?: string[]
  primary_domain?: string | null
  // Location (migration 016) — null when no place mentioned.
  location_lat?: number | null
  location_lng?: number | null
  location_name?: string | null
  // Date range (migration 016) — null when no time constraint mentioned.
  date_range_start?: string | null   // ISO date YYYY-MM-DD
  date_range_end?: string | null     // ISO date YYYY-MM-DD
  // Keywords (migration 023) — verbatim terms from wish text in original language.
  keywords?: string[] | null
  // Anchor entities (migration 025) — max 3 concrete nouns from the wish text.
  anchor_entities?: string[] | null
  // Anchor keywords (migration 026) — canonical IDs derived from needs + skills +
  // subject_entities + domain_entities. Used for structured recall.
  anchor_keywords?: string[] | null
  // Legacy fields — kept for backwards compatibility with old enrichment rows.
  emotional_tone?: string | null
  subject_type?: string | null
  target_action?: string | null
  object_of_need?: string[]
  constraints?: string[]
  confidence?: number | null
  ambiguity_flag?: boolean | null
}

export type ConnectionStatus = 'suggested' | 'accepted_by_a' | 'connected' | 'rejected'
export type MatchType = 'strong' | 'complementary' | 'similar'

// ── User Profile ─────────────────────────────────────────────────────────────

/** Shareable profile field names — the whitelist for per-connection disclosure. */
export type ProfileField =
  | 'display_name'
  | 'email'
  | 'phone'
  | 'country'
  | 'city'

/**
 * User profile — identity/contact details stored separately from wishes.
 * Fields are NEVER auto-shared; each field is disclosed per-connection only
 * when a user explicitly accepts and selects it.
 */
export interface UserProfile {
  id: string
  display_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  updated_at: string | null
}

// ── Connection Disclosure ─────────────────────────────────────────────────────

/** Per-side response to a published connection invitation. */
export type ConnectionResponse = 'pending' | 'accepted' | 'declined' | 'later'

/**
 * Derived disclosure state for a connection (computed in app layer).
 *   pending          — both sides still 'pending' or 'later'
 *   one_side_accepted— one accepted, other still pending/later
 *   mutual_accept    — mutual_accepted_at is set; both consented
 *   declined         — either side declined
 */
export type DisclosureState =
  | 'pending'
  | 'one_side_accepted'
  | 'mutual_accept'
  | 'declined'

export interface WishConnection {
  id: string
  wish_a: string
  wish_b: string
  match_score: number
  match_type: MatchType
  status: ConnectionStatus
  created_at: string
}

// Safe match preview — no identity revealed until both sides accept
export interface MatchResult {
  connection_id: string
  matched_wish_id: string
  match_score: number          // 0–1
  match_type: MatchType
  status: ConnectionStatus
  shared_themes: string[]      // intersection of themes
  match_summary: string        // human-readable e.g. "Complementary: they offer skills you need"
  matched_wish_text?: string   // original text of the matched wish
  explanation_text?: string    // short_reason from explanation JSONB
  overall_connection_score?: number | null
  opportunity?: { he: string; en: string } | null  // opportunity for the current wish's owner
  shared_basis?: { he: string; en: string } | null

  // ── Disclosure (per-connection double opt-in) ─────────────────────────────
  /** The current user's own response for this connection. */
  my_response: ConnectionResponse
  /** The other side's response (without revealing their snapshot until mutual). */
  other_response: ConnectionResponse
  /** Derived state from both responses. */
  disclosure_state: DisclosureState
  /**
   * The other side's shared profile snapshot — ONLY populated when
   * disclosure_state === 'mutual_accept'. Null otherwise.
   */
  other_shared_snapshot: Record<string, string | null> | null
  /** The other side's intro message — ONLY populated when mutual. Null otherwise. */
  other_intro_message: string | null
  /** The fields the current user chose to share (always available after accepting). */
  my_shared_fields: string[] | null
  /** The current user's own intro message (always available after accepting). */
  my_intro_message: string | null

  /** @deprecated Contact from wish record — replaced by other_shared_snapshot. Kept for admin view. */
  contact?: {
    name: string | null
    email: string | null
    phone: string | null
  }
}
