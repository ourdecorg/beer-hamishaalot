import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
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
    open:      { label: tr.visOpen,   icon: '✦',  cls: 'bg-well-50 border-well-200 text-well-700' },
    anonymous: { label: tr.visAnon,   icon: '🎭', cls: 'bg-sand-100 border-sand-200 text-sand-600' },
    private:   { label: tr.visPrivate, icon: '🔒', cls: 'bg-sand-50 border-sand-200 text-sand-500' },
  }

  const { data: wishes } = await supabase
    .from('wishes')
    .select('id, original_text, visibility, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const wishList = wishes ?? []
  const ids = wishList.map((w) => w.id)

  const matchCountMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: connections } = await supabase
      .from('wish_connections')
      .select('wish_a, wish_b')
      .or(`wish_a.in.(${ids.join(',')}),wish_b.in.(${ids.join(',')})`)
      .neq('status', 'deleted')

    for (const c of connections ?? []) {
      if (ids.includes(c.wish_a)) matchCountMap.set(c.wish_a, (matchCountMap.get(c.wish_a) ?? 0) + 1)
      if (ids.includes(c.wish_b)) matchCountMap.set(c.wish_b, (matchCountMap.get(c.wish_b) ?? 0) + 1)
    }
  }

  const resonanceCountMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: resonances } = await supabase
      .from('wish_resonances')
      .select('wish_id')
      .in('wish_id', ids)

    for (const r of resonances ?? []) {
      resonanceCountMap.set(r.wish_id, (resonanceCountMap.get(r.wish_id) ?? 0) + 1)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">
        <div className="mb-10">
          <p className="section-label mb-3">{tr.personalArea}</p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1
              className="text-3xl sm:text-4xl text-well-900"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              {tr.title}
            </h1>
            <Link href="/wishes/new" className="btn-primary px-5 py-2.5 text-sm">
              <span>✦</span>
              <span>{tr.newWish}</span>
            </Link>
          </div>
          <div className="h-px mt-4 bg-gradient-to-l from-transparent via-sand-300 to-transparent" />
          {wishList.length > 0 && (
            <p className="text-sand-400 text-sm mt-2">{tr.wishCount(wishList.length)}</p>
          )}
        </div>

        {wishList.length === 0 && (
          <div className="card-featured p-12 text-center">
            <div className="text-5xl mb-4">✦</div>
            <h2
              className="text-xl text-well-700 mb-3"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              {tr.emptyTitle}
            </h2>
            <p className="text-well-500 text-sm mb-6">{tr.emptySub}</p>
            <Link href="/wishes/new" className="btn-primary">
              <span>✦</span>
              <span>{tr.firstWish}</span>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {wishList.map((wish) => {
            const vis = visibilityLabel[wish.visibility as keyof typeof visibilityLabel]
              ?? visibilityLabel.open
            const matchCount = matchCountMap.get(wish.id) ?? 0
            const resonanceCount = resonanceCountMap.get(wish.id) ?? 0
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="section-label text-xs">{date}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${vis.cls}`}>
                      {vis.icon} {vis.label}
                    </span>
                    <DeleteWishButton wishId={wish.id} />
                  </div>
                </div>

                <p className="text-well-800 leading-relaxed">{truncated}</p>

                <div className="flex items-center gap-3 pt-1 border-t border-sand-100 flex-wrap">
                  {matchCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                      🎯 {tr.matches(matchCount)}
                    </span>
                  ) : (
                    <span className="text-xs text-sand-300">{tr.noMatches}</span>
                  )}
                  {resonanceCount > 0 && (
                    <span className="text-xs text-well-500">
                      💫 {tr.resonances(resonanceCount)}
                    </span>
                  )}
                  <span className="text-xs text-well-600 font-medium ms-auto">{tr.details}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <Footer />
    </div>
  )
}
