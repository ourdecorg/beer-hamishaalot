import Link from 'next/link'
import Header from '@/components/layout/Header'
import PeekBox from '@/components/home/PeekBox'
import { createClient } from '@/lib/supabase/server'
import { t, forwardArrow } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'

export default async function HomePage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang)
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = !!(user && adminEmail && user.email === adminEmail)

  const steps = tr.home.steps

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────── */}
        <section className="px-4 pt-14 pb-8 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-block text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-5 sm:mb-6 tracking-wide">
              {tr.home.heroLabel}
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 mb-4 sm:mb-5 leading-tight">
              {tr.home.h1}
            </h1>

            <p className="text-base sm:text-xl text-slate-600 mb-7 sm:mb-10 max-w-xl mx-auto leading-relaxed px-2">
              {tr.home.subtitle}
            </p>

            {/* ── Two-zone layout: Peek vs. Submit ── */}
            <div className="max-w-2xl mx-auto flex flex-col">

              {/* Zone 1 — Peek (no login required) */}
              <div className={`bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-6 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-0.5">
                  {lang === 'he' ? 'הצץ לבאר' : 'Peek into the Well'}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
                  {lang === 'he' ? 'ללא צורך בהתחברות — גלה משאלות מהדהדות' : 'No sign-in needed — discover resonant wishes'}
                </p>
                <PeekBox lang={lang} />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm text-slate-400 font-medium px-1">
                  {lang === 'he' ? 'או' : 'or'}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Zone 2 — Submit your own wish */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 text-center flex flex-col items-center gap-2.5 sm:gap-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest">
                  {lang === 'he' ? 'זרוק משאלה' : 'Send a Wish'}
                </p>
                <p className="text-base font-semibold text-slate-800">
                  {lang === 'he' ? 'יש לך משאלה משלך?' : 'Have your own wish?'}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
                  {lang === 'he'
                    ? 'הבאר מקשיבה — ה-AI ימצא אנשים שיכולים לעזור'
                    : 'The well is listening — AI will find people who can help'}
                </p>
                <Link
                  href={user ? '/wishes/new' : '/login'}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400
                             text-white text-sm font-semibold rounded-xl transition-all active:scale-95
                             w-full sm:w-auto justify-center"
                >
                  {user
                    ? (lang === 'he' ? 'כתוב משאלה חדשה' : 'Write a new wish')
                    : (lang === 'he' ? 'הצטרף לבאר' : 'Join the Well')}
                  <span>{forwardArrow(lang)}</span>
                </Link>
                {user && (
                  <Link
                    href="/wishes/my"
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1"
                  >
                    <span>{tr.home.myWishes}</span>
                    <span>{forwardArrow(lang)}</span>
                  </Link>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────── */}
        <section className="py-12 sm:py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 text-center mb-8 sm:mb-12">
              {tr.home.howLabel}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {steps.map((step, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-100 shadow-sm flex gap-4 sm:block">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0 sm:mb-4">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1 sm:mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof ──────────────────────────────── */}
        <section className="py-8 sm:py-10 px-4 text-center">
          <p className="text-slate-500 text-sm sm:text-base">{tr.home.proofText}</p>
        </section>

      </main>

      {isAdmin && (
        <div className="text-center py-4 border-t border-slate-200">
          <Link
            href="/admin/test-data"
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
          >
            {tr.home.adminLink}
          </Link>
        </div>
      )}

    </div>
  )
}
