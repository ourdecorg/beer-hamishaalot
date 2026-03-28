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
    <div className="card-hover p-6 flex flex-col gap-3 cursor-default">
      <div className="w-6 h-0.5 bg-amber-400 rounded-full" />
      <p className="text-well-800 leading-relaxed text-sm">{text}</p>
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = !!(user && adminEmail && user.email === adminEmail)

  let previewWishes: PreviewWish[] = FALLBACK_WISHES
  try {
    const { data } = await supabase
      .from('wishes')
      .select('original_text')
      .eq('visibility', 'open')
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

        {/* ── Hero ──────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 pb-28 sm:pt-32 sm:pb-40 px-4">
          {/* Atmospheric background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(21,73,99,0.12) 0%, transparent 60%)',
                'radial-gradient(ellipse 40% 30% at 80% 80%, rgba(201,155,85,0.06) 0%, transparent 50%)',
              ].join(', '),
            }}
          />

          <div className="max-w-4xl mx-auto text-center relative">
            {/* Well illustration */}
            <div className="relative mx-auto mb-12 w-40 h-40 flex items-center justify-center">
              {/* Ripple rings */}
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-well-400/20"
                  style={{
                    width: `${80 + i * 36}px`,
                    height: `${80 + i * 36}px`,
                    animation: `ripple 4s ease-out ${i * 0.9}s infinite`,
                  }}
                />
              ))}
              {/* Core */}
              <div
                className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #1c5f7a 0%, #0b2d41 100%)',
                  boxShadow: '0 8px 32px rgba(21,73,99,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset',
                }}
              >
                <span
                  className="text-3xl text-amber-300"
                  style={{ animation: 'float 3.5s ease-in-out infinite' }}
                >
                  ✦
                </span>
              </div>
            </div>

            <p className="section-label mb-5 tracking-[0.2em]">באר המשאלות</p>

            <h1
              className="text-5xl sm:text-7xl font-black text-well-900 mb-7 leading-tight"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              שתף משאלה שבלב —
              <br />
              <span className="text-well-600">ומצא את מי שיכול לעזור</span>
            </h1>

            <p className="text-lg sm:text-xl text-well-600 leading-relaxed mb-12 max-w-2xl mx-auto">
              פלטפורמה לחיבור בין אנשים על בסיס משאלות. ה-AI מנתח כל משאלה ומוצא התאמות —
              אנשים שיכולים לסייע, לשתף פעולה, או להצטרף אליך.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href={user ? '/wishes/new' : '/login'} className="btn-amber text-base">
                <span>✦</span>
                <span>כתוב את משאלתך</span>
              </Link>
              {user && (
                <Link href="/wishes/my" className="btn-secondary text-base">
                  <span>המשאלות שלי</span>
                  <span>←</span>
                </Link>
              )}
            </div>

            <p className="text-sm text-sand-400 mt-6">בחינם · ללא מחויבות</p>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────── */}
        <section className="py-24 px-4 bg-white/70">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="section-label mb-3">איך זה עובד</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                שלושה צעדים לחיבור
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
              {/* Connector lines — desktop only */}
              <div className="hidden sm:block absolute top-10 right-[33%] left-[33%] h-px bg-gradient-to-l from-sand-300 via-sand-200 to-sand-300 pointer-events-none" />

              {steps.map((step, i) => (
                <div key={i} className="card-featured p-8 text-center relative fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="flex justify-center mb-5">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                      style={{
                        background: 'linear-gradient(145deg, #edf5f8 0%, #d3e8f0 100%)',
                        boxShadow: '0 2px 8px rgba(21,73,99,0.12)',
                      }}
                    >
                      {step.emoji}
                    </div>
                  </div>
                  <div className="absolute top-5 left-5 w-6 h-6 rounded-full bg-well-700 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <h3
                    className="text-lg font-bold text-well-800 mb-3"
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

        {/* ── What you get ──────────────────────────────── */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
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
                <div key={i} className="card-hover p-8 text-center">
                  <div
                    className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{
                      background: o.bg,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                    }}
                  >
                    {o.icon}
                  </div>
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

        {/* ── Features ──────────────────────────────────── */}
        <section className="py-24 px-4 bg-white/70">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="section-label mb-3">מה מיוחד כאן</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מה מיוחד במנוע
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {features.map((f, i) => (
                <div key={i} className="card-hover p-7 flex gap-5 items-start">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{
                      background: f.bg,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <h3
                      className="text-base font-bold text-well-800 mb-2"
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

        {/* ── Well preview ──────────────────────────────── */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-label mb-3">הצצה לבאר</p>
              <h2
                className="text-3xl sm:text-4xl text-well-900"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מה כבר נמצא כאן
              </h2>
              <p className="text-well-500 mt-3 text-sm">משאלות אמיתיות מהבאר</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
              {previewWishes.map((w, i) => (
                <WishPreviewCard key={i} text={w.original_text} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────── */}
        <section className="py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="rounded-3xl p-14 text-white relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #154963 0%, #0b2d41 100%)',
                boxShadow: '0 20px 60px rgba(11,45,65,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset',
              }}
            >
              {/* Decorative stars */}
              <div className="absolute top-8 left-10 text-amber-300/30 text-5xl select-none pointer-events-none">✦</div>
              <div className="absolute bottom-10 right-12 text-amber-300/15 text-7xl select-none pointer-events-none">✦</div>
              <div className="absolute top-1/2 left-6 text-amber-300/10 text-3xl select-none pointer-events-none">✦</div>

              <p className="section-label text-well-400 mb-4 relative z-10">הצטרף לבאר</p>
              <h2
                className="text-3xl sm:text-5xl font-bold mb-5 relative z-10 leading-tight"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מוכן לשלח את משאלתך?
              </h2>
              <p className="text-well-300 mb-10 text-base leading-relaxed relative z-10 max-w-md mx-auto">
                המנוע ממתין. הבאר פתוחה. אולי מישהו שם בחוץ מחכה בדיוק למשאלה שלך.
              </p>
              <div className="flex gap-4 justify-center relative z-10 flex-wrap">
                <Link
                  href={user ? '/wishes/new' : '/login'}
                  className="btn-amber"
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
        <div className="text-center py-4 border-t border-sand-200">
          <Link
            href="/admin/test-data"
            className="text-xs text-sand-400 hover:text-well-600 underline underline-offset-2 transition-colors"
          >
            מסכי ניהול
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
    desc: 'שתף חלום, כוונה, או תקווה — בכמה מילים, עם פרטי קשר כדי שאחרים יוכלו ליצור קשר.',
  },
  {
    emoji: '✨',
    title: 'ה-AI מנתח את המשאלה',
    desc: 'מודל השפה מזהה נושאים, צרכים, יכולות, מיקום וטווח זמן — כדי למצוא חיבורים מדויקים.',
  },
  {
    emoji: '🔗',
    title: 'הבאר מגלה חיבורים',
    desc: 'המנוע מוצא משאלות קשורות ומשלימות ומציג פרטי קשר — כדי שתוכל להתחיל שיחה.',
  },
]

const outcomes = [
  {
    icon: '🎯',
    bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
    title: 'התאמות מדויקות',
    desc: 'המנוע מנתח נושא, צרכים, יכולות, מיקום וזמינות — ומחבר בין משאלות שיכולות באמת להיפגש.',
  },
  {
    icon: '🤝',
    bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
    title: 'חיבור ישיר',
    desc: 'כשנמצאת התאמה, פרטי הקשר של שני הצדדים מוצגים — ניתן ליצור קשר מיידית.',
  },
  {
    icon: '💫',
    bg: 'linear-gradient(145deg, #fdfaf5, #f9f3e7)',
    title: 'הדהוד קהילתי',
    desc: 'כשמשאלתך נוגעת למישהו, הם יכולים להדהד — ולהראות לך שאתה לא לבד.',
  },
]

const features = [
  {
    icon: '🎯',
    bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
    title: 'התאמות חכמות',
    desc: 'המנוע מזהה משאלות דומות ומשלימות — בין אם מישהו מחפש בדיוק מה שיש לך לתת, ובין אם חולקים אתך אותה שאיפה.',
  },
  {
    icon: '📍',
    bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
    title: 'מודע למיקום ולזמן',
    desc: 'אם ציינת מיקום או טווח זמן, המנוע מוודא שהמשאלות שמופגשות רלוונטיות גם גיאוגרפית וגם לוח-זמנית.',
  },
  {
    icon: '✨',
    bg: 'linear-gradient(145deg, #fdfaf5, #f2e5cd)',
    title: 'AI שמבין הקשר',
    desc: 'הניתוח מזהה את תחום העניין, הכוונה וסוג האובייקט — כדי להימנע מחיבורים מוטעים בין נושאים שונים.',
  },
  {
    icon: '📬',
    bg: 'linear-gradient(145deg, #edf5f8, #a9d2e2)',
    title: 'יצירת קשר ישירה',
    desc: 'כל משאלה כוללת פרטי קשר. כשנמצאת התאמה — אפשר לפנות ישירות, ללא מתווכים.',
  },
]
