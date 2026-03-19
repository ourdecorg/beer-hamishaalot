// ============================================================
// באר המשאלות — Core Domain Types
// ============================================================

export type WishVisibility = 'private' | 'anonymous' | 'open'

export interface Wish {
  id: string
  user_id: string
  original_text: string
  visibility: WishVisibility
  created_at: string
  updated_at: string
  // Contact info — only for open wishes
  contact_name: string | null
  contact_email: string | null
  contact_country: string | null
  contact_city: string | null
  contact_address: string | null
  contact_phone: string | null
  user_email: string | null
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

// Contact info for open wishes
export interface WishContactInfo {
  contact_name: string
  contact_country: string
  contact_city: string
  contact_address?: string
  contact_phone?: string
}

// API request/response shapes
export interface CreateWishInput {
  original_text: string
  visibility: WishVisibility
  contact?: WishContactInfo
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
  themes: string[]
  intent: string | null
  needs: string[]
  skills_offered: string[]
  collaboration_type: string | null
  emotional_tone: string | null
  analyzed_at: string
  // Primary domain label (migration 013) — null on rows analyzed before 013.
  primary_domain?: string | null
  // Object-aware fields — null/empty on rows analyzed before migration 012.
  // All matching code must handle these gracefully (treat missing as neutral).
  subject_type?: string | null
  subject_entities?: string[]
  target_action?: string | null
  object_of_need?: string[]
  constraints?: string[]
  domain_entities?: string[]
}

export type ConnectionStatus = 'suggested' | 'accepted_by_a' | 'connected' | 'rejected'
export type MatchType = 'SIMILAR' | 'COMPLEMENTARY' | 'RESONANT'

export interface WishConnection {
  id: string
  wish_a: string
  wish_b: string
  match_score: number
  match_type: MatchType
  status: ConnectionStatus
  created_at: string
}

// Safe match preview — no identity revealed until both sides approve
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
  contact?: {
    name: string | null
    email: string | null
    phone: string | null
  }
}
