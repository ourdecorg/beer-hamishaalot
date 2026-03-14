import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WishCard from '@/components/wishes/WishCard'
import { createClient } from '@/lib/supabase/server'
import { getPersonalizedFeed } from '@/lib/feed/getPersonalizedFeed'
import Link from 'next/link'
import type { WishWithResonance } from '@/lib/types'

export const metadata = {
  title: 'הבאר — באר המשאלות',
  description: 'משאלות שנשלחו אל הבאר',
}

// Personalised per-user — disable static caching
export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let wishes: WishWithResonance[] = []
  let personalized = false
  let profile_strength: 'none' | 'partial' | 'full' = 'none'

  if (user) {
    // ── Personalised feed ────────────────────────────────────────────────
    const result = await getPersonalizedFeed(user.id, supabase)
    wishes = result.wishes   // ScoredWish extends WishWithResonance — no mapping needed
    personalized = result.personalized
    profile_strength = result.profile_strength
  } else {
    // ── Public feed: newest first ────────────────────────────────────────
    const { data: raw } = await supabase
      .from('wishes')
      .select('*')
      .in('visibility', ['anonymous', 'open'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (raw && raw.length > 0) {
      const wishIds = raw.map(w => w.id)

      const { data: resonances } = await supabase
        .from('wish_resonances')
        .select('wish_id')
        .in('wish_id', wishIds)

      const resonanceCounts: Record<string, number> = {}
      resonances?.forEach(r => {
        resonanceCounts[r.wish_id] = (resonanceCounts[r.wish_id] ?? 0) + 1
      })

      wishes = raw.map(w => ({
        ...w,
        resonance_count: resonanceCounts[w.id] ?? 0,
        user_has_resonated: false,
      }))
    }
  }

  // ── Feed subheading ────────────────────────────────────────────────────────
  let feedLabel = 'משאלות שנשלחו אל הבאר על-ידי אנשים מכל מקום.'
  if (personalized) {
    feedLabel =
      profile_strength === 'full'
        ? 'הבאר בחרה עבורך משאלות על-פי תחומי העניין, הכישורים והחלומות שלך.'
        : 'הבאר מתאימה את עצמה עבורך — ככל שתוסיף משאלות, כך הדיוק יגדל.'
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
        {/* Page header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-well-800 shadow mb-4">
            <span className="text-xl text-amber-300">✦</span>
          </div>
          <h1
            className="text-4xl font-bold text-well-900 mb-2"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            הבאר
          </h1>
          <p className="text-well-500 max-w-md mx-auto">
            {feedLabel}
          </p>

          {/* Personalised badge */}
          {personalized && (
            <span className="inline-block mt-3 px-3 py-1 text-xs rounded-full bg-well-100 text-well-700 border border-well-200">
              ✦ פיד מותאם אישית
            </span>
          )}
        </div>

        {/* CTA for non-authenticated */}
        {!user && (
          <div className="mb-8 flex items-center justify-center gap-4 p-4 bg-well-50 border border-well-200 rounded-2xl">
            <p className="text-well-700 text-sm">
              יש לך משאלה? הצטרף לבאר ושלח אותה.
            </p>
            <Link href="/login" className="btn-primary text-sm px-4 py-2">
              הצטרף
            </Link>
          </div>
        )}

        {/* Wishes grid */}
        {wishes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-30">💧</div>
            <h2
              className="text-2xl text-well-700 mb-2"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              הבאר שקטה
            </h2>
            <p className="text-sand-500 mb-6">
              עדיין אין משאלות ציבוריות. היה הראשון לשלוח.
            </p>
            <Link href="/wishes/new" className="btn-primary">
              <span>✦</span>
              <span>שלח משאלה</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {wishes.map((wish) => (
                <WishCard
                  key={wish.id}
                  wish={wish}
                  isAuthenticated={!!user}
                />
              ))}
            </div>

            <div className="text-center mt-10">
              <p className="text-sm text-sand-400">
                מוצגות {wishes.length} משאלות
                {personalized ? ' — ממוינות לפי רלוונטיות עבורך' : ' אחרונות'}
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
