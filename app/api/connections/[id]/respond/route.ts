/**
 * POST /api/connections/[id]/respond
 *
 * Records a user's invitation response for a published connection opportunity.
 * This is the double opt-in + per-connection disclosure flow.
 *
 * Request body:
 *   response:      'accepted' | 'declined' | 'later'
 *   shared_fields: string[]   (which profile fields to share — required for 'accepted', may be empty)
 *   intro_message: string     (optional personal note)
 *
 * Behaviour:
 *   - Determines which side (A or B) the authenticated user is on.
 *   - Validates the user has not already given a final response (accepted/declined).
 *   - For 'accepted': reads the user's profile and snapshots only the chosen fields.
 *   - Saves the response + disclosure data to the appropriate user_a_* / user_b_* columns.
 *   - If BOTH sides are now 'accepted', sets mutual_accepted_at — the gate for identity reveal.
 *
 * Acceptance and disclosure are distinct concerns in the data model:
 *   user_a_response                     = the decision
 *   user_a_shared_fields_json           = field names chosen to share
 *   user_a_shared_profile_snapshot_json = immutable value snapshot at acceptance time
 *   user_a_intro_message                = optional personal note
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ConnectionResponse, ProfileField } from '@/lib/types'

const SHAREABLE_FIELDS: ProfileField[] = [
  'display_name',
  'email',
  'phone',
  'linkedin_url',
  'short_bio',
  'city',
  'address',
  'organization',
  'role',
]

interface Params {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const response = body.response as string
  const rawFields: unknown = body.shared_fields
  const introMessage: string | null =
    typeof body.intro_message === 'string' ? body.intro_message.trim() || null : null

  if (!['accepted', 'declined', 'later'].includes(response)) {
    return NextResponse.json(
      { error: 'response must be one of: accepted, declined, later' },
      { status: 400 }
    )
  }

  const sharedFields: string[] = Array.isArray(rawFields)
    ? (rawFields as unknown[]).filter((f): f is string => typeof f === 'string')
    : []

  // Use admin client to fetch connection (wish_connections has no public RLS policy)
  const admin = createAdminClient()

  const { data: conn } = await admin
    .from('wish_connections')
    .select(
      'id, wish_a, wish_b, published, mutual_accepted_at, user_a_response, user_b_response'
    )
    .eq('id', params.id)
    .single()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  if (!conn.published)
    return NextResponse.json({ error: 'Connection is not published' }, { status: 403 })
  if (conn.mutual_accepted_at)
    return NextResponse.json(
      { error: 'Connection is already mutually accepted' },
      { status: 409 }
    )

  // Determine which side this user is on
  const [{ data: wishA }, { data: wishB }] = await Promise.all([
    admin.from('wishes').select('user_id').eq('id', conn.wish_a).single(),
    admin.from('wishes').select('user_id').eq('id', conn.wish_b).single(),
  ])

  const isOwnerA = wishA?.user_id === user.id
  const isOwnerB = wishB?.user_id === user.id

  if (!isOwnerA && !isOwnerB) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent overwriting a final response (accepted or declined)
  const myCurrentResponse = isOwnerA ? conn.user_a_response : conn.user_b_response
  if (myCurrentResponse === 'accepted' || myCurrentResponse === 'declined') {
    return NextResponse.json(
      { error: 'You have already responded', current_response: myCurrentResponse },
      { status: 409 }
    )
  }

  // ── Build disclosure snapshot (only for 'accepted') ───────────────────────
  let snapshotFields: string[] | null = null
  let snapshotValues: Record<string, unknown> | null = null

  if (response === 'accepted') {
    // Validate fields against whitelist
    const validFields = sharedFields.filter((f): f is ProfileField =>
      (SHAREABLE_FIELDS as string[]).includes(f)
    )

    snapshotFields = validFields

    if (validFields.length > 0) {
      // Fetch user's own profile (RLS-gated: only owner can read)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      snapshotValues = Object.fromEntries(
        validFields.map((f) => [
          f,
          profile ? (profile as Record<string, unknown>)[f] ?? null : null,
        ])
      )
    } else {
      // Accepted but chose to share nothing — explicit, valid choice
      snapshotValues = {}
    }
  }

  // ── Build the update payload ──────────────────────────────────────────────
  const prefix = isOwnerA ? 'user_a' : 'user_b'
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = {
    [`${prefix}_response`]: response as ConnectionResponse,
    [`${prefix}_responded_at`]: now,
  }

  if (response === 'accepted') {
    updates[`${prefix}_shared_fields_json`] = snapshotFields
    updates[`${prefix}_shared_profile_snapshot_json`] = snapshotValues
    updates[`${prefix}_intro_message`] = introMessage
  }

  // Check if this triggers mutual acceptance
  const otherResponse = isOwnerA ? conn.user_b_response : conn.user_a_response
  const isMutual = response === 'accepted' && otherResponse === 'accepted'
  if (isMutual) {
    updates.mutual_accepted_at = now
  }

  const { error: updateError } = await admin
    .from('wish_connections')
    .update(updates)
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({
    response,
    mutual: isMutual,
    connection_id: params.id,
  })
}
