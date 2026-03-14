import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPersonalizedFeed } from '@/lib/feed/getPersonalizedFeed'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed
 *
 * Returns a personalised, ranked list of public wishes for the logged-in user.
 * Falls back to a trending (chronological + engagement) feed for new users.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getPersonalizedFeed(user.id, supabase)

  // Strip internal scoring metadata before sending to the client
  const wishes = result.wishes.map(({ score_breakdown, enrichment, ...wish }) => wish)

  return NextResponse.json({
    wishes,
    personalized: result.personalized,
    profile_strength: result.profile_strength,
  })
}
