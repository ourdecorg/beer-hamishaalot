import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import type { MatchType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ההתאמות שלי — באר המשאלות' }

// ── Types ────────────────────────────────────────────────────────────────────

interface MatchRow {
  connectionId: string
  matchScore: number
  matchType: MatchType
  matchedAt: string
  // User side
  myWishId: string
  myWishText: string
  // Other side
  theirWishId: string
  theirWishText: string
  theirName: string | null
  theirEmail: string | null
  theirPhone: string | null
  sharedThemes: string[]
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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

  // 2. All connections for those wishes, sorted by score desc
  const { data: connections } = await supabase
    .from('wish_connections')
    .select('id, wish_a, wish_b, match_score, match_type, created_at')
    .or(`wish_a.in.(${myWishIds.join(',')}),wish_b.in.(${myWishIds.join(',')})`)
    .order('match_score', { ascending: false })

  const connList = connections ?? []

  if (connList.length === 0) {
    return <EmptyLayout message="המנוע טרם מצא התאמות — חזור מאוחר יותר" />
  }

  // 3. Collect matched wish IDs (the other side)
  const matchedIds = connList.map(c =>
    myWishIds.includes(c.wish_a) ? c.wish_b : c.wish_a
  )
  const uniqueMatchedIds = [...new Set(matchedIds)]

  // 4. Fetch matched wishes (text + contact)
  const { data: theirWishes } = await supabase
    .from('wishes')
    .select('id, original_text, contact_name, contact_email, contact_phone')
    .in('id', uniqueMatchedIds)

  const theirWishMap = new Map(
    (theirWishes ?? []).map(w => [w.id, w])
  )

  // 5. Fetch enrichments for shared theme computation
  const allIds = [...myWishIds, ...uniqueMatchedIds]
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, themes')
    .in('wish_id', allIds)

  const themeMap = new Map<string, string[]>(
    (enrichments ?? []).map(e => [e.wish_id, e.themes ?? []])
  )

  // 6. Build display rows
  const rows: MatchRow[] = connList.map(conn => {
    const myWishId    = myWishIds.includes(conn.wish_a) ? conn.wish_a : conn.wish_b
    const theirWishId = myWishId === conn.wish_a ? conn.wish_b : conn.wish_a
    const them        = theirWishMap.get(theirWishId)

    const myThemes    = new Set((themeMap.get(myWishId)    ?? []).map(t => t.toLowerCase().trim()))
    const theirThemes =         (themeMap.get(theirWishId) ?? [])
    const sharedThemes = theirThemes.filter(t => myThemes.has(t.toLowerCase().trim()))

    return {
      connectionId:  conn.id,
      matchScore:    conn.match_score,
      matchType:     conn.match_type as MatchType,
      matchedAt:     conn.created_at,
      myWishId,
      myWishText:    myWishTextMap.get(myWishId) ?? '',
      theirWishId,
      theirWishText: them?.original_text ?? '',
      theirName:     them?.contact_name ?? null,
      theirEmail:    them?.contact_email ?? null,
      theirPhone:    them?.contact_phone ?? null,
      sharedThemes,
    }
  })

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
            {rows.length} {rows.length === 1 ? 'התאמה' : 'התאמות'} · ממוינות לפי ציון
          </p>
        </div>

        {/* Match cards */}
        <div className="space-y-5">
          {rows.map((row) => (
            <div
              key={row.connectionId}
              className="card p-6 space-y-5"
            >
              {/* Header: type + score + date */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${matchTypeBg[row.matchType] ?? 'bg-sand-100 border-sand-200 text-sand-700'}`}>
                    {matchTypeLabel[row.matchType] ?? row.matchType}
                  </span>
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #edf5f8, #d3e8f0)',
                      color: '#154963',
                    }}
                  >
                    {Math.round(row.matchScore * 100)}%
                  </span>
                </div>
                <span className="text-xs text-sand-400">{fmt(row.matchedAt)}</span>
              </div>

              {/* Their wish */}
              <div className="bg-sand-50 border border-sand-200 rounded-xl px-5 py-4 space-y-2">
                <p className="section-label text-xs">המשאלה התואמת</p>
                <p className="text-sm text-well-700 leading-relaxed">
                  {truncate(row.theirWishText)}
                </p>
              </div>

              {/* My wish context */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sand-400 mt-0.5 whitespace-nowrap">
                  ← מתאים למשאלתך
                </span>
                <Link
                  href={`/wishes/${row.myWishId}`}
                  className="text-xs text-well-600 hover:text-well-800 leading-relaxed line-clamp-2 transition-colors"
                >
                  {truncate(row.myWishText, 140)}
                </Link>
              </div>

              {/* Shared themes */}
              {row.sharedThemes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {row.sharedThemes.map(t => (
                    <span key={t} className="tag-badge text-xs">{t}</span>
                  ))}
                </div>
              )}

              {/* Contact */}
              {(row.theirName || row.theirEmail) && (
                <div
                  className="rounded-xl px-5 py-4 space-y-1.5"
                  style={{ background: 'linear-gradient(145deg, #edf5f8, #d3e8f0)' }}
                >
                  <p className="section-label mb-2">פרטי קשר</p>
                  {row.theirName && (
                    <p className="text-well-800 font-semibold text-sm">{row.theirName}</p>
                  )}
                  {row.theirEmail && (
                    <p className="text-sm" dir="ltr">
                      <a
                        href={`mailto:${row.theirEmail}?subject=שיתוף פעולה — באר המשאלות`}
                        className="text-well-700 underline underline-offset-2 hover:text-well-500 font-medium"
                      >
                        {row.theirEmail}
                      </a>
                    </p>
                  )}
                  {row.theirPhone && (
                    <p className="text-well-700 text-sm font-medium" dir="ltr">{row.theirPhone}</p>
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
