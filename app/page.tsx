import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 sm:py-32 px-4">
          {/* Soft radial background */}
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
              {/* Ripple rings */}
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
              {/* Well circle */}
              <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-well-700 to-well-900 shadow-lg flex items-center justify-center">
                <span className="text-3xl text-amber-300" style={{ animation: 'float 3s ease-in-out infinite' }}>
                  ✦
                </span>
              </div>
            </div>

            {/* Title */}
            <h1
              className="text-5xl sm:text-7xl font-black text-well-900 mb-3 leading-tight"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              באר המשאלות
            </h1>
            <p className="text-lg text-sand-500 mb-8 tracking-wide">
              Well of Wishes
            </p>

            <p className="text-xl sm:text-2xl text-well-700 leading-relaxed mb-10 max-w-xl mx-auto">
              מקום קדוש לשחרר את משאלות ליבך אל הבאר.
              <br />
              <span className="text-well-500 text-lg">
                A sacred space to cast your deepest wishes into the universe.
              </span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/wishes/new" className="btn-primary text-lg px-8 py-4">
                <span>✦</span>
                <span>שלח משאלה</span>
              </Link>
              <Link href="/wishes/feed" className="btn-secondary text-lg px-8 py-4">
                <span>הציצי בבאר</span>
                <span>→</span>
              </Link>
            </div>
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
                שלושה צעדים פשוטים
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

        {/* ── Features ─────────────────────────────────────── */}
        <section className="py-20 px-4">
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

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="rounded-3xl p-12 text-white relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #154963 0%, #0b2d41 100%)',
              }}
            >
              {/* Decorative stars */}
              <div className="absolute top-6 left-8 text-amber-300/40 text-4xl select-none">✦</div>
              <div className="absolute bottom-8 right-10 text-amber-300/20 text-6xl select-none">✦</div>

              <h2
                className="text-3xl sm:text-4xl font-bold mb-4 relative z-10"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                מוכן לשלח את משאלתך?
              </h2>
              <p className="text-well-200 mb-8 text-lg relative z-10">
                הצטרף לבאר ושחרר את מה שנמצא בלבך.
              </p>
              <div className="flex gap-4 justify-center relative z-10">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-amber-400 hover:bg-amber-300 text-well-900 font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                >
                  <span>✦</span>
                  <span>הצטרף עכשיו</span>
                </Link>
                <Link href="/wishes/feed" className="btn-ghost text-well-200 hover:bg-well-800">
                  צפה בבאר
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

const steps = [
  {
    emoji: '✍️',
    title: 'כתוב את משאלתך',
    desc: 'שתף את מה שנמצא בלבך — חלום, כוונה, או תקווה — בכמה מילים.',
  },
  {
    emoji: '✨',
    title: 'הבינה המלאכותית מעמיקה',
    desc: 'קלוד מנסח סיכום פיוטי, תגיות ומשפט כוונה שמאיר את עומק משאלתך.',
  },
  {
    emoji: '💧',
    title: 'הבאר מגיבה',
    desc: 'אנשים אחרים יכולים להדהד את משאלתך — ולהראות לך שאתה לא לבד.',
  },
]

const features = [
  {
    icon: '🔒',
    title: 'שליטה על פרטיות',
    desc: 'בחר: פרטי (רק אתה), אנונימי (גלוי ללא שמך), או פתוח (עם שמך). הבאר שומרת על גבולותיך.',
  },
  {
    icon: '🤖',
    title: 'העמקה עם AI',
    desc: 'קלוד מנתח את משאלתך ומחזיר לך סיכום פיוטי, תגיות רלוונטיות, ומשפט כוונה מעמיק.',
  },
  {
    icon: '💫',
    title: 'הדהוד קהילתי',
    desc: 'כשמשאלתך נוגעת ללב מישהו, הם יכולים להדהד — ולהראות לך שדברים חשובים משותפים.',
  },
  {
    icon: '📖',
    title: 'הבאר הציבורית',
    desc: 'פיד של משאלות אנונימיות ופתוחות — מקום של חמלה, השראה, ואנושיות משותפת.',
  },
]
