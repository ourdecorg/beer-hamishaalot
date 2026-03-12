import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WishCard from '@/components/wishes/WishCard'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { WishWithResonance } from '@/lib/types'

export const metadata = {
  title: 'הבאר — באר המשאלות',
  description: 'משאלות שנשלחו אל הבאר',
}

// Revalidate every 60 seconds
export const revalidate = 60

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch public wishes (anonymous + open), newest first
  const { data: wishes } = await supabase
    .from('wishes')
    .select('*')
    .in('visibility', ['anonymous', 'open'])
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch resonance counts for all fetched wishes
  let wishesWithResonance: WishWithResonance[] = []

  if (wishes && wishes.length > 0) {
    const wishIds = wishes.map((w) => w.id)

    const { data: resonances } = await supabase
      .from('wish_resonances')
      .select('wish_id')
      .in('wish_id', wishIds)

    // Count resonances per wish
    const resonanceCounts: Record<string, number> = {}
    resonances?.forEach((r) => {
      resonanceCounts[r.wish_id] = (resonanceCounts[r.wish_id] ?? 0) + 1
    })

    // Check which ones the current user has resonated with
    const userResonated = new Set<string>()
    if (user) {
      const { data: ownResonances } = await supabase
        .from('wish_resonances')
        .select('wish_id')
        .eq('user_id', user.id)
        .in('wish_id', wishIds)

      ownResonances?.forEach((r) => userResonated.add(r.wish_id))
    }

    wishesWithResonance = wishes.map((w) => ({
      ...w,
      resonance_count: resonanceCounts[w.id] ?? 0,
      user_has_resonated: userResonated.has(w.id),
    }))
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
            משאלות שנשלחו אל הבאר על-ידי אנשים מכל מקום.
            <br />
            כל אחת מהן נושאת עמה אור.
          </p>
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
        {wishesWithResonance.length === 0 ? (
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
              {wishesWithResonance.map((wish) => (
                <WishCard
                  key={wish.id}
                  wish={wish}
                  isAuthenticated={!!user}
                />
              ))}
            </div>

            <div className="text-center mt-10">
              <p className="text-sm text-sand-400">
                מוצגות {wishesWithResonance.length} משאלות אחרונות
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
