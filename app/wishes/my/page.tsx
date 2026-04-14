import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import DeleteWishButton from '@/components/wishes/DeleteWishButton'
import { t, dateLocale } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const lang = await getLang()
  return { title: t(lang).myWishes.pageTitle }
}

export default async function MyWishesPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang).myWishes
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visibilityLabel = {
    open:      { label: tr.visOpen,    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    anonymous: { label: tr.visAnon,    cls: 'bg-slate-100 border-slate-200 text-slate-600' },
    private:   { label: tr.visPrivate, cls: 'bg-slate-50 border-slate-200 text-slate-500' },
  }

  const { data: wishes } = await supabase
    .from('wishes')
    .select('id, original_text, visibility, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const wishList = wishes ?? []
  const ids = wishList.map((w) => w.id)

  // Parallel fetches for matches, resonances, enrichment, best connection scores, and notes
  const [connectionsRes, resonancesRes, connEnrichRes, notesRes] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('wish_connections')
          .select('wish_a, wish_b')
          .or(`wish_a.in.(${ids.join(',')}),wish_b.in.(${ids.join(',')})`)
          .neq('status', 'deleted')
          .eq('published', true)
      : Promise.resolve({ data: [] }),

    ids.length > 0
      ? supabase.from('wish_resonances').select('wish_id').in('wish_id', ids)
      : Promise.resolve({ data: [] }),

    ids.length > 0
      ? supabase
          .from('connection_enrichment')
          .select('wish_a_id, wish_b_id, overall_connection_score')
          .or(`wish_a_id.in.(${ids.join(',')}),wish_b_id.in.(${ids.join(',')})`)
      : Promise.resolve({ data: [] }),

    ids.length > 0
      ? supabase.from('wish_notes').select('wish_id').in('wish_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const matchCountMap = new Map<string, number>()
  for (const c of connectionsRes.data ?? []) {
    if (ids.includes(c.wish_a)) matchCountMap.set(c.wish_a, (matchCountMap.get(c.wish_a) ?? 0) + 1)
    if (ids.includes(c.wish_b)) matchCountMap.set(c.wish_b, (matchCountMap.get(c.wish_b) ?? 0) + 1)
  }

  const resonanceCountMap = new Map<string, number>()
  for (const r of resonancesRes.data ?? []) {
    resonanceCountMap.set(r.wish_id, (resonanceCountMap.get(r.wish_id) ?? 0) + 1)
  }

  const noteCountMap = new Map<string, number>()
  for (const n of notesRes.data ?? []) {
    noteCountMap.set(n.wish_id, (noteCountMap.get(n.wish_id) ?? 0) + 1)
  }

  // Best overall_connection_score per wish
  const bestScoreMap = new Map<string, number>()
  for (const row of connEnrichRes.data ?? []) {
    const score = row.overall_connection_score
    for (const wid of [row.wish_a_id, row.wish_b_id]) {
      if (ids.includes(wid)) {
        const prev = bestScoreMap.get(wid) ?? 0
        if (score > prev) bestScoreMap.set(wid, score)
      }
    }
  }

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
            <Link href="/wishes/new" className="btn-primary px-5 py-2.5 text-sm">
              <span>{tr.newWish}</span>
            </Link>
          </div>
          <div className="h-px mt-4 bg-slate-200" />
          {wishList.length > 0 && (
            <p className="text-slate-400 text-sm mt-2">{tr.wishCount(wishList.length)}</p>
          )}
        </div>

        {wishList.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-4">🌱</div>
            <h2 className="text-xl font-bold text-slate-700 mb-3">
              {tr.emptyTitle}
            </h2>
            <p className="text-slate-500 text-sm mb-6">{tr.emptySub}</p>
            <Link href="/wishes/new" className="btn-primary">
              <span>{tr.firstWish}</span>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {wishList.map((wish) => {
            const vis = visibilityLabel[wish.visibility as keyof typeof visibilityLabel]
              ?? visibilityLabel.open
            const matchCount    = matchCountMap.get(wish.id)    ?? 0
            const resonanceCount = resonanceCountMap.get(wish.id) ?? 0
            const bestScore    = bestScoreMap.get(wish.id)    ?? null
            const noteCount    = noteCountMap.get(wish.id)    ?? 0

            const date = new Date(wish.created_at).toLocaleDateString(dateLocale(lang), {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            const truncated =
              wish.original_text.length > 200
                ? wish.original_text.slice(0, 200) + '…'
                : wish.original_text

            return (
              <Link
                key={wish.id}
                href={`/wishes/${wish.id}`}
                className="card-hover p-6 flex flex-col gap-3 block"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="section-label text-xs">{date}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${vis.cls}`}>
                      {vis.label}
                    </span>
                    <DeleteWishButton wishId={wish.id} />
                  </div>
                </div>

                {/* Wish text */}
                <p className="text-slate-800 leading-relaxed">{truncated}</p>

                {/* Footer row */}
                <div className="flex items-center gap-3 pt-1 border-t border-slate-100 flex-wrap">
                  {matchCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                      🎯 {tr.matches(matchCount)}
                      {bestScore != null && (
                        <span className="font-black text-indigo-900 ms-1">{bestScore}/100</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">{tr.noMatches}</span>
                  )}
                  {resonanceCount > 0 && (
                    <span className="text-xs text-slate-500">
                      💛 {tr.resonances(resonanceCount)}
                    </span>
                  )}
                  {noteCount > 0 && (
                    <span className="text-xs text-slate-500">
                      💬 {noteCount === 1 ? 'פתק 1' : `${noteCount} פתקים`}
                    </span>
                  )}
                  <span className="text-xs text-slate-600 font-medium ms-auto">{tr.details}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

    </div>
  )
}
