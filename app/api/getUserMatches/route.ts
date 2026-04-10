/**
 * POST /api/getUserMatches
 *
 * Webhook: returns all wishes + grouped matches for a user by email.
 * Auth: Authorization: Bearer <WEBHOOK_SECRET>
 *
 * Request body:  { "email": "user@example.com" }
 * Response:      { email, totalWishes, totalConnections, groups: GroupedMatch[] }
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MatchType } from '@/lib/types'

interface MyWishMatch {
  connectionId: string
  myWishId: string
  myWishText: string
  matchScore: number
  matchType: MatchType
  matchedAt: string
  sharedThemes: string[]
}

interface GroupedMatch {
  theirWishId: string
  theirWishText: string
  maxScore: number
  maxMatchType: MatchType
  allSharedThemes: string[]
  myMatches: MyWishMatch[]
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let email: string | undefined
  try {
    const body = await request.json() as { email?: string }
    email = body.email?.trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Find user's wishes by email ────────────────────────────────────────
  const { data: myWishes } = await admin
    .from('wishes')
    .select('id, original_text')
    .eq('user_email', email)
    .neq('status', 'cancelled')

  const myWishList = myWishes ?? []
  const myWishIds = myWishList.map(w => w.id)
  const myWishTextMap = new Map(myWishList.map(w => [w.id, w.original_text as string]))

  if (myWishIds.length === 0) {
    return NextResponse.json({ email, totalWishes: 0, totalConnections: 0, groups: [] })
  }

  // ── 2. All connections for those wishes ───────────────────────────────────
  const { data: connections } = await admin
    .from('wish_connections')
    .select('id, wish_a, wish_b, match_score, match_type, created_at')
    .or(`wish_a.in.(${myWishIds.join(',')}),wish_b.in.(${myWishIds.join(',')})`)
    .neq('status', 'deleted')
    .eq('published', true)
    .order('match_score', { ascending: false })

  const connList = connections ?? []

  if (connList.length === 0) {
    return NextResponse.json({ email, totalWishes: myWishIds.length, totalConnections: 0, groups: [] })
  }

  // ── 3. Collect matched wish IDs (the other side) ──────────────────────────
  const uniqueMatchedIds = [...new Set(
    connList.map(c => myWishIds.includes(c.wish_a) ? c.wish_b : c.wish_a)
  )]

  // ── 4. Fetch matched wishes (text + contact) ──────────────────────────────
  const { data: theirWishes } = await admin
    .from('wishes')
    .select('id, original_text')
    .in('id', uniqueMatchedIds)

  const theirWishMap = new Map((theirWishes ?? []).map(w => [w.id, w]))

  // ── 5. Fetch enrichments for shared theme computation ─────────────────────
  const { data: enrichments } = await admin
    .from('wish_enrichment')
    .select('wish_id, themes')
    .in('wish_id', [...myWishIds, ...uniqueMatchedIds])

  const themeMap = new Map<string, string[]>(
    (enrichments ?? []).map(e => [e.wish_id, (e.themes ?? []) as string[]])
  )

  // ── 6. Build flat rows ────────────────────────────────────────────────────
  const flatList: Array<MyWishMatch & { theirWishId: string }> = connList.map(conn => {
    const myWishId    = myWishIds.includes(conn.wish_a) ? conn.wish_a : conn.wish_b
    const theirWishId = myWishId === conn.wish_a ? conn.wish_b : conn.wish_a
    const myThemes    = new Set((themeMap.get(myWishId) ?? []).map((t: string) => t.toLowerCase().trim()))
    const theirThemes = themeMap.get(theirWishId) ?? []
    return {
      connectionId: conn.id,
      myWishId,
      myWishText:   myWishTextMap.get(myWishId) ?? '',
      matchScore:   conn.match_score,
      matchType:    conn.match_type as MatchType,
      matchedAt:    conn.created_at,
      sharedThemes: theirThemes.filter((t: string) => myThemes.has(t.toLowerCase().trim())),
      theirWishId,
    }
  })

  // ── 7. Group by theirWishId ───────────────────────────────────────────────
  const groupMap = new Map<string, GroupedMatch>()
  for (const row of flatList) {
    const them = theirWishMap.get(row.theirWishId)
    const existing = groupMap.get(row.theirWishId)
    if (!existing) {
      groupMap.set(row.theirWishId, {
        theirWishId:    row.theirWishId,
        theirWishText:  them?.original_text ?? '',
        maxScore:       row.matchScore,
        maxMatchType:   row.matchType,
        allSharedThemes: row.sharedThemes,
        myMatches:      [row],
      })
    } else {
      existing.myMatches.push(row)
      existing.allSharedThemes = [...new Set([...existing.allSharedThemes, ...row.sharedThemes])]
    }
  }

  const groups: GroupedMatch[] = [...groupMap.values()]
    .sort((a, b) => b.maxScore - a.maxScore)

  return NextResponse.json({
    email,
    totalWishes: myWishIds.length,
    totalConnections: flatList.length,
    groups,
  })
}
