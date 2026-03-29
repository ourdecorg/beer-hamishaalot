import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { t, dateLocale } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'
import type { MatchType } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const lang = await getLang()
  return { title: t(lang).matches.pageTitle }
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  theirName: string | null
  theirEmail: string | null
  theirPhone: string | null
  maxScore: number
  maxMatchType: MatchType
  myMatches: MyWishMatch[]
  allSharedThemes: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const matchTypeCls: Record<string, string> = {
  strong:        'bg-indigo-50 border-indigo-200 text-indigo-700',
  complementary: 'bg-blue-50 border-blue-200 text-blue-700',
  similar:       'bg-slate-100 border-slate-200 text-slate-600',
}

function truncate(s: string, n = 220) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MyMatchesPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang).matches

  const matchTypeLabel: Record<string, string> = {
    strong:        tr.typeStrong,
    complementary: tr.typeComplementary,
    similar:       tr.typeSimilar,
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString(dateLocale(lang), {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myWishes } = await supabase
    .from('wishes')
    .select('id, original_text')
    .eq('user_id', user.id)

  const myWishList = myWishes ?? []
  const myWishIds = myWishList.map(w => w.id)
  const myWishTextMap = new Map(myWishList.map(w => [w.id, w.original_text]))

  if (myWishIds.length === 0) {
    return <EmptyLayout message={tr.emptyNoWishes} cta ctaLabel={tr.firstWish} trPersonal={tr.personalArea} trTitle={tr.title} />
  }

  const { data: connections } = await supabase
    .from('wish_connections')
    .select('id, wish_a, wish_b, match_score, match_type, created_at')
    .or(`wish_a.in.(${myWishIds.join(',')}),wish_b.in.(${myWishIds.join(',')})`)
    .neq('status', 'deleted')
    .order('match_score', { ascending: false })

  const connList = connections ?? []
  if (connList.length === 0) {
    return <EmptyLayout message={tr.emptyNoMatches} trPersonal={tr.personalArea} trTitle={tr.title} />
  }

  const uniqueMatchedIds = [...new Set(
    connList.map(c => myWishIds.includes(c.wish_a) ? c.wish_b : c.wish_a)
  )]

  const { data: theirWishes } = await supabase
    .from('wishes')
    .select('id, original_text, contact_name, contact_email, contact_phone')
    .in('id', uniqueMatchedIds)

  const theirWishMap = new Map((theirWishes ?? []).map(w => [w.id, w]))

  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, themes')
    .in('wish_id', [...myWishIds, ...uniqueMatchedIds])

  const themeMap = new Map<string, string[]>(
    (enrichments ?? []).map(e => [e.wish_id, e.themes ?? []])
  )

  const flatList: Array<MyWishMatch & { theirWishId: string }> = connList.map(conn => {
    const myWishId    = myWishIds.includes(conn.wish_a) ? conn.wish_a : conn.wish_b
    const theirWishId = myWishId === conn.wish_a ? conn.wish_b : conn.wish_a
    const myThemes    = new Set((themeMap.get(myWishId) ?? []).map((th: string) => th.toLowerCase().trim()))
    const theirThemes = themeMap.get(theirWishId) ?? []
    return {
      connectionId: conn.id,
      myWishId,
      myWishText:   myWishTextMap.get(myWishId) ?? '',
      matchScore:   conn.match_score,
      matchType:    conn.match_type as MatchType,
      matchedAt:    conn.created_at,
      sharedThemes: theirThemes.filter((th: string) => myThemes.has(th.toLowerCase().trim())),
      theirWishId,
    }
  })

  const groupMap = new Map<string, GroupedMatch>()
  for (const row of flatList) {
    const existing = groupMap.get(row.theirWishId)
    const them = theirWishMap.get(row.theirWishId)
    if (!existing) {
      groupMap.set(row.theirWishId, {
        theirWishId:     row.theirWishId,
        theirWishText:   them?.original_text ?? '',
        theirName:       them?.contact_name  ?? null,
        theirEmail:      them?.contact_email ?? null,
        theirPhone:      them?.contact_phone ?? null,
        maxScore:        row.matchScore,
        maxMatchType:    row.matchType,
        myMatches:       [row],
        allSharedThemes: row.sharedThemes,
      })
    } else {
      existing.myMatches.push(row)
      const allThemes = new Set([...existing.allSharedThemes, ...row.sharedThemes])
      existing.allSharedThemes = [...allThemes]
    }
  }

  const groups: GroupedMatch[] = [...groupMap.values()]
    .sort((a, b) => b.maxScore - a.maxScore)

  const totalConnections = flatList.length

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">

        <div className="mb-10">
          <p className="section-label mb-3">{tr.personalArea}</p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {tr.title}
            </h1>
            <Link href="/wishes/my" className="btn-ghost text-sm">
              {tr.backToWishes}
            </Link>
          </div>
          <div className="h-px mt-4 bg-slate-200" />
          <p className="text-slate-400 text-sm mt-2">
            {tr.matchCount(groups.length, totalConnections)}
          </p>
        </div>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.theirWishId} className="card p-6 space-y-5">

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${matchTypeCls[group.maxMatchType] ?? 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                    {matchTypeLabel[group.maxMatchType] ?? group.maxMatchType}
                  </span>
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {Math.round(group.maxScore * 100)}%
                  </span>
                  {group.myMatches.length > 1 && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                      {tr.moreWishes(group.myMatches.length)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {fmt(group.myMatches[0].matchedAt)}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 space-y-2">
                <p className="section-label text-xs">{tr.theirWish}</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {truncate(group.theirWishText)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="section-label text-xs">
                  {group.myMatches.length === 1 ? tr.matchesYourWish : tr.yourMatchingWishes}
                </p>
                {group.myMatches.map((m, idx) => (
                  <div
                    key={m.connectionId}
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                      group.myMatches.length > 1 ? 'bg-slate-50 border border-slate-100' : ''
                    }`}
                  >
                    {group.myMatches.length > 1 && (
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <span className="text-xs font-bold text-slate-700">
                          {Math.round(m.matchScore * 100)}%
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${matchTypeCls[m.matchType] ?? 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                          {matchTypeLabel[m.matchType]?.split(' ')[1] ?? m.matchType}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/wishes/${m.myWishId}`}
                      className="text-xs text-slate-600 hover:text-slate-900 leading-relaxed line-clamp-3 transition-colors flex-1"
                    >
                      {truncate(m.myWishText, group.myMatches.length > 1 ? 160 : 140)}
                    </Link>
                    {group.myMatches.length > 1 && (
                      <span className="text-[10px] text-slate-400 shrink-0 pt-0.5">
                        {String(idx + 1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {group.allSharedThemes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {group.allSharedThemes.map(th => (
                    <span key={th} className="tag-badge text-xs">{th}</span>
                  ))}
                </div>
              )}

              {(group.theirName || group.theirEmail) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 space-y-1.5">
                  <p className="section-label mb-2">{tr.contactDetails}</p>
                  {group.theirName && (
                    <p className="text-slate-800 font-semibold text-sm">{group.theirName}</p>
                  )}
                  {group.theirEmail && (
                    <p className="text-sm" dir="ltr">
                      <a
                        href={`mailto:${group.theirEmail}?subject=${encodeURIComponent(tr.emailSubject)}`}
                        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 font-medium"
                      >
                        {group.theirEmail}
                      </a>
                    </p>
                  )}
                  {group.theirPhone && (
                    <p className="text-slate-700 text-sm font-medium" dir="ltr">{group.theirPhone}</p>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>

      </main>

    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyLayout({
  message,
  cta = false,
  ctaLabel = '',
  trPersonal,
  trTitle,
}: {
  message: string
  cta?: boolean
  ctaLabel?: string
  trPersonal: string
  trTitle: string
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">
        <div className="mb-10">
          <p className="section-label mb-3">{trPersonal}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {trTitle}
          </h1>
          <div className="h-px mt-4 bg-slate-200" />
        </div>
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-slate-600 text-sm font-medium mb-1">{message}</p>
          {cta && (
            <Link href="/wishes/new" className="btn-primary mt-6 inline-flex">
              <span>{ctaLabel}</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
