import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'

type PreviewWish = {
  original_text: string
}

const FALLBACK_WISHES: PreviewWish[] = [
  { original_text: 'רוצה ללמוד ערבית בשיח אמיתי עם מישהו שמדבר ערבית בבית, ולתת בחזרה עברית או מוזיקה.' },
  { original_text: 'מחפש שותפה להקמת קבוצת ריצה קהילתית בשכונה, פעם בשבוע, לכל הגילאים.' },
  { original_text: 'יש לי ניסיון בבניית MVPים לסטארטאפים, ואני מחפש מיזם חינוכי שאפשר לבנות יחד.' },
]

function WishPreviewCard({ text }: { text: string }) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <p className="text-well-800 leading-relaxed text-sm line-clamp-4">{text}</p>
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = !!(user && adminEmail && user.email === adminEmail)

  // Fetch top public wishes for preview — fall back to static examples
  let previewWishes: PreviewWish[] = FALLBACK_WISHES
  try {
    const { data } = await supabase
      .from('wishes')
      .select('original_text')
      .in('visibility', ['anonymous', 'open'])
      .order('resonance_count', { ascending: false })
      .limit(3)
    if (data && data.length >= 3) previewWishes = data
  } catch {
    // fallback already set
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 sm:py-32 px-4">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(42,120,153,0.08) 0%, transparent 70%)',
            }}
          />

          <div className="max-w-3xl mx-auto text-center relative">
            {/* Well illustration */}
            <div className="relative mx-auto mb-10 w-32 h-32 flex items-center justify-center">
              <div
                className="absolute rounded-full border-2 border-well-300/40 w-32 h-32"
                style={{ animation: 'ripple 3s ease-out infinite' }}
              />
              <div
                className="absolute rounded-full border-2 border-well-300/30 w-32 h-32"
                style={{ animation: 'ripple 3s ease-out infinite', animationDelay: '1s' }}
              />
              <div
                className="absolute rounded-full border-2 border-well-300/20 w-32 h-32"
                style={{ animation: 'ripple 3s ease-out infinite', animationDelay: '2s' }}
              />
              <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-well-700 to-well-900 shadow-lg flex items-center justify-center">
                <span className="text-3xl text-amber-300" style={{ animation: 'float 3s ease-in-out infinite' }}>
                  ✦
                </span>
              </div>
            </div>

            <p className="section-label mb-4">באר המשאלות</p>

            <h1
              className="text-4xl sm:text-6xl font-black text-well-900 mb-6 leading-tight"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              שתף משאלה שבלב —
              <br />
              וגלה שאתה לא לבד
            </h1>

            <p className="text-lg sm:text-xl text-well-600 leading-relaxed mb-10 max-w-2xl mx-auto">
              מקום לכתוב חלומות, כוונות ותקוות. הבינה המלאכותית מעמיקה כל משאלה, ומערכת ההתאמות
              מגלה חיבורים בין אנשים שחולקים שאיפות דומות.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
              <Link href="/wishes/new" className="btn-primary text-lg px-8 py-4">
                <span>✦</span>
                <span>כתוב את משאלתך</span>
              </Link>
            </div>

            <p className="text-sm text-sand-400">
              ניתן לשלוח בעילום שם · בחינם · ללא מחויבות
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="py-20 px-4 bg-white/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-label mb-3">איך זה עובד</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                שלושה צעדים
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <div key={i} className="card p-8 text-center fade-in">
                  <div className="text-4xl mb-4">{step.emoji}</div>
                  <h3
                    className="text-xl font-bold text-well-800 mb-3"
                    style={{ fontFamily: 'var(--font-frank-ruhl)' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-well-600 leading-relaxed text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What you get ─────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-label mb-3">מה מקבלים</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                יותר ממקום לשמור משאלות
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {outcomes.map((o, i) => (
                <div key={i} className="card p-8 text-center hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4">{o.icon}</div>
                  <h3
                    className="text-lg font-bold text-well-800 mb-3"
                    style={{ fontFamily: 'var(--font-frank-ruhl)' }}
                  >
                    {o.title}
                  </h3>
                  <p className="text-well-600 text-sm leading-relaxed">{o.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section className="py-20 px-4 bg-white/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-label mb-3">מה מיוחד כאן</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                הבאר מוקשבת
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="card p-8 flex gap-5 items-start hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl flex-shrink-0">{f.icon}</div>
                  <div>
                    <h3
                      className="text-lg font-bold text-well-800 mb-2"
                      style={{ fontFamily: 'var(--font-frank-ruhl)' }}
                    >
                      {f.title}
                    </h3>
                    <p className="text-well-600 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Public well preview ───────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-label mb-3">הצצה לבאר</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מה כבר נמצא כאן
              </h2>
              <p className="text-well-500 mt-3 text-sm">
                משאלות אמיתיות מהבאר — מוצגות בעילום שם
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              {previewWishes.map((w, i) => (
                <WishPreviewCard
                  key={i}
                  text={w.original_text}
                />
              ))}
            </div>

          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="rounded-3xl p-12 text-white relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #154963 0%, #0b2d41 100%)',
              }}
            >
              <div className="absolute top-6 left-8 text-amber-300/40 text-4xl select-none">✦</div>
              <div className="absolute bottom-8 right-10 text-amber-300/20 text-6xl select-none">✦</div>

              <h2
                className="text-3xl sm:text-4xl font-bold mb-4 relative z-10"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מוכן לשלח את משאלתך?
              </h2>
              <p className="text-well-200 mb-8 text-lg relative z-10">
                ה-AI ממתין. הבאר פתוחה.
              </p>
              <div className="flex gap-4 justify-center relative z-10">
                <Link
                  href={user ? '/wishes/new' : '/login'}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-amber-400 hover:bg-amber-300 text-well-900 font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                >
                  <span>✦</span>
                  <span>שלח משאלה</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {isAdmin && (
        <div className="text-center py-4">
          <Link
            href="/admin/test-data"
            className="text-xs text-well-400 hover:text-well-600 underline underline-offset-2"
          >
            ניהול — טעינת נתוני בדיקה
          </Link>
        </div>
      )}

      <Footer />
    </div>
  )
}

const steps = [
  {
    emoji: '✍️',
    title: 'כתוב את משאלתך',
    desc: 'שתף חלום, כוונה, או תקווה — בכמה מילים. לא צריך להיות מושלם.',
  },
  {
    emoji: '✨',
    title: 'ה-AI מנתח את המשאלה',
    desc: 'מודל השפה מזהה נושאים, צרכים ויכולות — כדי שמנוע ההתאמות יוכל לגלות חיבורים עם משאלות אחרות.',
  },
  {
    emoji: '🔗',
    title: 'הבאר מגלה חיבורים',
    desc: 'המערכת מצלבת את משאלתך עם משאלות אחרות ומציגה הדהודים — אנשים שיכולים לסייע, לשתף פעולה, או פשוט לחוש יחד.',
  },
]

const outcomes = [
  {
    icon: '🔍',
    title: 'ניתוח AI מעמיק',
    desc: 'המערכת מזהה נושאים, צרכים, יכולות ותחום עניין — ומשתמשת בהם כדי לגלות התאמות מדויקות.',
  },
  {
    icon: '🎯',
    title: 'הצעות חיבור',
    desc: 'המערכת מנתחת צרכים ויכולות, ומגלה משאלות קשורות ואנשים עם שאיפות משלימות לשלך.',
  },
  {
    icon: '💫',
    title: 'הדהוד קהילתי',
    desc: 'כשמשאלתך נוגעת למישהו, הם יכולים להדהד — ולהראות לך שאתה לא לבד.',
  },
]

const features = [
  {
    icon: '🎯',
    title: 'התאמות חכמות',
    desc: 'המערכת מנתחת צרכים, יכולות ותחומי עניין, ומגלה חיבורים פוטנציאליים עם אנשים שמשאלותיהם יכולות להיפגש עם שלך.',
  },
  {
    icon: '🔒',
    title: 'שליטה מלאה על פרטיות',
    desc: 'בחר בין פרטי (רק אתה), אנונימי (ללא שמך), או פתוח (עם פרטי קשר). לא צריך להירשם כדי להציץ בבאר.',
  },
  {
    icon: '✨',
    title: 'AI שמבין אנשים',
    desc: 'הבינה המלאכותית לא רק מסכמת — היא מגלה מה באמת חשוב לך, ומה אתה יכול לתת לאחרים.',
  },
  {
    icon: '📖',
    title: 'הבאר הציבורית',
    desc: 'פיד של משאלות אנונימיות ופתוחות — מקום של חמלה, השראה, ואנושיות משותפת.',
  },
]
