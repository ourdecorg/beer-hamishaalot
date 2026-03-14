import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'שיתופי פעולה — באר המשאלות',
}

const matchTypeLabel: Record<string, string> = {
  RESONANT: '✦ הדהוד',
  COMPLEMENTARY: '◈ משלים',
  SIMILAR: '◎ דומה',
}

const matchTypeBg: Record<string, string> = {
  RESONANT: 'bg-amber-50 border-amber-200 text-amber-800',
  COMPLEMENTARY: 'bg-well-50 border-well-200 text-well-800',
  SIMILAR: 'bg-sand-100 border-sand-200 text-sand-700',
}

export default async function CollaborationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all of the user's wishes
  const { data: myWishes } = await supabase
    .from('wishes')
    .select('id, original_text, ai_summary, contact_name, contact_email, contact_phone, visibility')
    .eq('user_id', user.id)
    .in('visibility', ['anonymous', 'open'])

  const myWishIds = (myWishes ?? []).map((w) => w.id)

  if (myWishIds.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 fade-in text-center">
          <div className="text-5xl mb-6">🌱</div>
          <h1
            className="text-3xl font-bold text-well-900 mb-4"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            שיתופי פעולה
          </h1>
          <p className="text-well-600 mb-8">
            עוד לא הזנת משאלות פתוחות או אנונימיות. הכנס משאלה כדי שמנוע ההדהוד יתחיל לפעול.
          </p>
          <Link href="/wishes/new" className="btn-primary">
            <span>✦</span>
            <span>משאלה חדשה</span>
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  // Fetch all connections involving the user's wishes
  const { data: connections } = await supabase
    .from('wish_connections')
    .select('*')
    .or(myWishIds.map((id) => `wish_a.eq.${id}`).join(',') + ',' + myWishIds.map((id) => `wish_b.eq.${id}`).join(','))
    .order('match_score', { ascending: false })

  if (!connections || connections.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 fade-in text-center">
          <div className="text-5xl mb-6">✦</div>
          <h1
            className="text-3xl font-bold text-well-900 mb-4"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            שיתופי פעולה
          </h1>
          <p className="text-well-600 mb-2">
            מנוע ההדהוד עדיין מחפש התאמות למשאלותיך.
          </p>
          <p className="text-sand-400 text-sm">חזור/י מאוחר יותר — מתאמים חדשים נוצרים ברקע.</p>
        </main>
        <Footer />
      </div>
    )
  }

  // Collect all wish IDs we need to fetch (both sides of every connection)
  const allWishIds = Array.from(new Set(
    connections.flatMap((c) => [c.wish_a, c.wish_b])
  ))

  // Fetch wish details for all involved wishes
  const { data: allWishes } = await supabase
    .from('wishes')
    .select('id, original_text, ai_summary, contact_name, contact_email, contact_phone, visibility, user_id')
    .in('id', allWishIds)

  const wishMap = new Map((allWishes ?? []).map((w) => [w.id, w]))

  // Fetch enrichments for theme display
  const { data: enrichments } = await supabase
    .from('wish_enrichment')
    .select('wish_id, themes')
    .in('wish_id', allWishIds)

  const enrichmentMap = new Map((enrichments ?? []).map((e) => [e.wish_id, e.themes as string[]]))

  // Build collaboration pairs
  const collaborations = connections.map((conn) => {
    const isA = myWishIds.includes(conn.wish_a)
    const myWishId = isA ? conn.wish_a : conn.wish_b
    const otherWishId = isA ? conn.wish_b : conn.wish_a

    return {
      id: conn.id,
      match_score: conn.match_score,
      match_type: conn.match_type as string,
      myWish: wishMap.get(myWishId),
      otherWish: wishMap.get(otherWishId),
      myThemes: enrichmentMap.get(myWishId) ?? [],
      otherThemes: enrichmentMap.get(otherWishId) ?? [],
    }
  }).filter((c) => c.myWish && c.otherWish)

  // Deduplicate: same pair may appear twice if user owns both sides
  const seen = new Set<string>()
  const unique = collaborations.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 fade-in">
        {/* Page header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-well-800 shadow-lg mb-4">
            <span className="text-xl text-amber-300">◈</span>
          </div>
          <h1
            className="text-3xl font-bold text-well-900 mb-2"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            שיתופי פעולה
          </h1>
          <p className="text-well-500 text-sm">
            אלו המשאלות שמהדהדות עם שלך — אנשים שכדאי להכיר
          </p>
        </div>

        <div className="space-y-8">
          {unique.map((collab) => {
            const sharedThemes = collab.myThemes.filter((t) =>
              collab.otherThemes.map((x) => x.toLowerCase()).includes(t.toLowerCase())
            )
            const other = collab.otherWish!
            const mine = collab.myWish!

            return (
              <div key={collab.id} className="card p-6 space-y-5">
                {/* Match type + score */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${matchTypeBg[collab.match_type]}`}>
                    {matchTypeLabel[collab.match_type]}
                  </span>
                  <span className="text-xs text-sand-400">
                    התאמה: <strong className="text-well-700">{Math.round(collab.match_score * 100)}%</strong>
                  </span>
                </div>

                {/* Two wishes side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* My wish */}
                  <div className="bg-sand-50 rounded-xl p-4 border border-sand-200">
                    <p className="text-xs text-sand-400 mb-2 font-medium">המשאלה שלך</p>
                    <p className="text-sm text-well-800 leading-relaxed line-clamp-4">
                      {mine.original_text || mine.ai_summary}
                    </p>
                    {other.contact_email && (
                      <div className="mt-3 pt-3 border-t border-sand-200">
                        <p className="text-xs text-sand-400 mb-1">פרטי קשר של הצד השני</p>
                        <p className="text-xs text-well-700 font-medium" dir="ltr">
                          {other.contact_name && <span>{other.contact_name} · </span>}
                          <a href={`mailto:${other.contact_email}?subject=שיתוף פעולה — באר המשאלות`} className="underline hover:no-underline">
                            {other.contact_email}
                          </a>
                        </p>
                        {other.contact_phone && (
                          <p className="text-xs text-well-600 mt-0.5" dir="ltr">{other.contact_phone}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Other wish */}
                  <div className="bg-well-50 rounded-xl p-4 border border-well-200">
                    <p className="text-xs text-well-400 mb-2 font-medium">משאלה מהדהדת</p>
                    <p className="text-sm text-well-800 leading-relaxed line-clamp-4">
                      {other.original_text || other.ai_summary}
                    </p>
                    {mine.contact_email && (
                      <div className="mt-3 pt-3 border-t border-well-200">
                        <p className="text-xs text-well-400 mb-1">הפרטים שלך כפי שמוצגים לצד השני</p>
                        <p className="text-xs text-well-700 font-medium" dir="ltr">
                          {mine.contact_name && <span>{mine.contact_name} · </span>}
                          {mine.contact_email}
                        </p>
                        {mine.contact_phone && (
                          <p className="text-xs text-well-600 mt-0.5" dir="ltr">{mine.contact_phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shared themes */}
                {sharedThemes.length > 0 && (
                  <div>
                    <p className="text-xs text-sand-400 mb-2">נושאים משותפים</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sharedThemes.map((theme) => (
                        <span key={theme} className="tag-badge text-xs">{theme}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact info + invitation */}
                {other.contact_email && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <p
                      className="text-well-900 font-bold mb-1"
                      style={{ fontFamily: 'var(--font-frank-ruhl)' }}
                    >
                      הגיע הזמן להיפגש ✦
                    </p>
                    <p className="text-well-600 text-sm mb-4">
                      המשאלות שלכם מהדהדות — שלח/י הודעה ותאמו פגישה.
                    </p>
                    <div className="space-y-1 text-sm">
                      {other.contact_name && (
                        <p className="text-well-800 font-medium">{other.contact_name}</p>
                      )}
                      <p dir="ltr">
                        <a
                          href={`mailto:${other.contact_email}?subject=שיתוף פעולה — באר המשאלות`}
                          className="text-well-700 underline hover:no-underline font-medium"
                        >
                          {other.contact_email}
                        </a>
                      </p>
                      {other.contact_phone && (
                        <p className="text-well-700" dir="ltr">{other.contact_phone}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Anonymous wish — no contact */}
                {other.visibility === 'anonymous' && !other.contact_email && (
                  <div className="bg-sand-100 border border-sand-200 rounded-xl p-4 text-sm text-sand-500 text-center">
                    <p>המשאלה המהדהדת היא אנונימית — פרטי קשר אינם זמינים.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      <Footer />
    </div>
  )
}
