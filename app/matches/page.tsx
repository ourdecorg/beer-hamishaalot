import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import type { MatchType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ההתאמות שלי — באר המשאלות' }

// ── Types ────────────────────────────────────────────────────────────────────

interface MyWishMatch {
  connectionId: string
  myWishId: string
  myWishText: string
  matchScore: number
  matchType: MatchType
  matchedAt: string
  sharedThemes: string[]
}

/** One card per external wish — may have multiple of the user's wishes inside */
interface GroupedMatch {
  theirWishId: string
  theirWishText: string
  theirName: string | null
  theirEmail: string | null
  theirPhone: string | null
  maxScore: number
  maxMatchType: MatchType
  myMatches: MyWishMatch[]   // sorted by matchScore desc
  allSharedThemes: string[]  // union across all myMatches
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const matchTypeLabel: Record<string, string> = {
  strong:        '✦ הדהוד',
  complementary: '◈ משלים',
  similar:       '◎ דומה',
}

const matchTypeBg: Record<string, string> = {
  strong:        'bg-amber-50 border-amber-200 text-amber-800',
  complementary: 'bg-well-50 border-well-200 text-well-800',
  similar:       'bg-sand-100 border-sand-200 text-sand-700',
}

function truncate(s: string, n = 220) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MyMatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. All user's wishes
  const { data: myWishes } = await supabase
    .from('wishes')
    .select('id, original_text')
    .eq('user_id', user.id)

  const myWishList = myWishes ?? []
  const myWishIds = myWishList.map(w => w.id)
  const myWishTextMap = new Map(myWishList.map(w => [w.id, w.original_text]))

  if (myWishIds.length === 0) {
    return <EmptyLayout message="עדיין אין משאלות — צור משאלה ראשונה" cta />
  }

  // 2. All connections for those wishes
  const { data: connections } = await supabase
    .from('wish_connections')
    .select('id, wish_a, wish_b, match_score, match_type, created_at')
    .or(`wish_a.in.(${myWishIds.join(',')}),wish_b.in.(${myWishIds.join(',')})`)
    .neq('status', 'deleted')
    .order('match_score', { ascending: false })

  const connList = connections ?? []
  if (connList.length === 0) {
    return <EmptyLayout message="המנוע טרם מצא התאמות — חזור מאוחר יותר" />
  }

  // 3. Collect matched wish IDs (the other side)
  const uniqueMatchedIds = [...new Set(
    connList.map(c => myWishIds.includes(c.wish_a) ? c.wish_b : c.wish_a)
  )]

  // 4. Fetch matched wishes (text + contact)
  const { data: theirWishes } = await supabase
    .from('wishes')
    .select('id, original_text, contact_name, contact_email, contact_phone')
    .in('id', uniqueMatchedIds)

  const theirWishMap = new Map((theirWishes ?? []).map(w => [w.id, w]))

  // 5. Fetch enrichments for shared theme computation
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, themes')
    .in('wish_id', [...myWishIds, ...uniqueMatchedIds])

  const themeMap = new Map<string, string[]>(
    (enrichments ?? []).map(e => [e.wish_id, e.themes ?? []])
  )

  // 6. Build flat rows
  const flatList: Array<MyWishMatch & { theirWishId: string }> = connList.map(conn => {
    const myWishId    = myWishIds.includes(conn.wish_a) ? conn.wish_a : conn.wish_b
    const theirWishId = myWishId === conn.wish_a ? conn.wish_b : conn.wish_a
    const myThemes    = new Set((themeMap.get(myWishId)    ?? []).map(t => t.toLowerCase().trim()))
    const theirThemes = themeMap.get(theirWishId) ?? []
    return {
      connectionId: conn.id,
      myWishId,
      myWishText:   myWishTextMap.get(myWishId) ?? '',
      matchScore:   conn.match_score,
      matchType:    conn.match_type as MatchType,
      matchedAt:    conn.created_at,
      sharedThemes: theirThemes.filter(t => myThemes.has(t.toLowerCase().trim())),
      theirWishId,
    }
  })

  // 7. Group by theirWishId
  const groupMap = new Map<string, GroupedMatch>()
  for (const row of flatList) {
    const existing = groupMap.get(row.theirWishId)
    const them = theirWishMap.get(row.theirWishId)
    if (!existing) {
      groupMap.set(row.theirWishId, {
        theirWishId:    row.theirWishId,
        theirWishText:  them?.original_text ?? '',
        theirName:      them?.contact_name  ?? null,
        theirEmail:     them?.contact_email ?? null,
        theirPhone:     them?.contact_phone ?? null,
        maxScore:       row.matchScore,
        maxMatchType:   row.matchType,
        myMatches:      [row],
        allSharedThemes: row.sharedThemes,
      })
    } else {
      existing.myMatches.push(row)
      const allThemes = new Set([...existing.allSharedThemes, ...row.sharedThemes])
      existing.allSharedThemes = [...allThemes]
      // maxScore is already the highest because connList is sorted desc
    }
  }

  // Sort groups by maxScore desc (group insertion order follows sorted connList,
  // but the first row per group sets maxScore correctly)
  const groups: GroupedMatch[] = [...groupMap.values()]
    .sort((a, b) => b.maxScore - a.maxScore)

  const totalConnections = flatList.length

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">

        {/* Page header */}
        <div className="mb-10">
          <p className="section-label mb-3">האזור האישי שלך</p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1
              className="text-3xl sm:text-4xl text-well-900"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              ההתאמות שלי
            </h1>
            <Link href="/wishes/my" className="btn-ghost text-sm">
              ← המשאלות שלי
            </Link>
          </div>
          <div className="h-px mt-4 bg-gradient-to-l from-transparent via-sand-300 to-transparent" />
          <p className="text-sand-400 text-sm mt-2">
            {groups.length} {groups.length === 1 ? 'משאלה תואמת' : 'משאלות תואמות'}
            {totalConnections !== groups.length && ` · ${totalConnections} חיבורים`}
            {' · ממוינות לפי ציון'}
          </p>
        </div>

        {/* Match cards */}
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.theirWishId} className="card p-6 space-y-5">

              {/* Header: best score + type */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${matchTypeBg[group.maxMatchType] ?? 'bg-sand-100 border-sand-200 text-sand-700'}`}>
                    {matchTypeLabel[group.maxMatchType] ?? group.maxMatchType}
                  </span>
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #edf5f8, #d3e8f0)', color: '#154963' }}
                  >
                    {Math.round(group.maxScore * 100)}%
                  </span>
                  {group.myMatches.length > 1 && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                      {group.myMatches.length} משאלות שלך תואמות
                    </span>
                  )}
                </div>
                <span className="text-xs text-sand-400">
                  {fmt(group.myMatches[0].matchedAt)}
                </span>
              </div>

              {/* Their wish */}
              <div className="bg-sand-50 border border-sand-200 rounded-xl px-5 py-4 space-y-2">
                <p className="section-label text-xs">המשאלה התואמת</p>
                <p className="text-sm text-well-700 leading-relaxed">
                  {truncate(group.theirWishText)}
                </p>
              </div>

              {/* My matching wishes */}
              <div className="space-y-2">
                <p className="section-label text-xs">
                  {group.myMatches.length === 1 ? 'מתאים למשאלתך' : 'המשאלות שלך שתואמות'}
                </p>
                {group.myMatches.map((m, idx) => (
                  <div
                    key={m.connectionId}
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                      group.myMatches.length > 1
                        ? 'bg-sand-50 border border-sand-200'
                        : ''
                    }`}
                  >
                    {/* Per-wish score badge — only when multiple */}
                    {group.myMatches.length > 1 && (
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <span className="text-xs font-bold text-well-700">
                          {Math.round(m.matchScore * 100)}%
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${matchTypeBg[m.matchType] ?? 'bg-sand-100 border-sand-200 text-sand-600'}`}>
                          {matchTypeLabel[m.matchType]?.split(' ')[1] ?? m.matchType}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/wishes/${m.myWishId}`}
                      className="text-xs text-well-600 hover:text-well-800 leading-relaxed line-clamp-3 transition-colors flex-1"
                    >
                      {truncate(m.myWishText, group.myMatches.length > 1 ? 160 : 140)}
                    </Link>
                    {group.myMatches.length > 1 && (
                      <span className="text-[10px] text-sand-400 shrink-0 pt-0.5">
                        {String(idx + 1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Shared themes — union across all matches */}
              {group.allSharedThemes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {group.allSharedThemes.map(t => (
                    <span key={t} className="tag-badge text-xs">{t}</span>
                  ))}
                </div>
              )}

              {/* Contact */}
              {(group.theirName || group.theirEmail) && (
                <div
                  className="rounded-xl px-5 py-4 space-y-1.5"
                  style={{ background: 'linear-gradient(145deg, #edf5f8, #d3e8f0)' }}
                >
                  <p className="section-label mb-2">פרטי קשר</p>
                  {group.theirName && (
                    <p className="text-well-800 font-semibold text-sm">{group.theirName}</p>
                  )}
                  {group.theirEmail && (
                    <p className="text-sm" dir="ltr">
                      <a
                        href={`mailto:${group.theirEmail}?subject=שיתוף פעולה — באר המשאלות`}
                        className="text-well-700 underline underline-offset-2 hover:text-well-500 font-medium"
                      >
                        {group.theirEmail}
                      </a>
                    </p>
                  )}
                  {group.theirPhone && (
                    <p className="text-well-700 text-sm font-medium" dir="ltr">{group.theirPhone}</p>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyLayout({ message, cta = false }: { message: string; cta?: boolean }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">
        <div className="mb-10">
          <p className="section-label mb-3">האזור האישי שלך</p>
          <h1
            className="text-3xl sm:text-4xl text-well-900"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            ההתאמות שלי
          </h1>
          <div className="h-px mt-4 bg-gradient-to-l from-transparent via-sand-300 to-transparent" />
        </div>
        <div className="card-featured p-12 text-center">
          <div className="text-4xl mb-4 opacity-40">✦</div>
          <p className="text-well-600 text-sm font-medium mb-1">{message}</p>
          {cta && (
            <Link href="/wishes/new" className="btn-primary mt-6 inline-flex">
              <span>✦</span>
              <span>כתוב את משאלתך הראשונה</span>
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
