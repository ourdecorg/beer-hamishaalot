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
        <section className="px-4 pt-20 pb-10 sm:pt-28 sm:pb-14">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-block text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-6 tracking-wide">
              {tr.home.heroLabel}
            </p>

            <h1 className="text-5xl sm:text-6xl font-black text-slate-900 mb-5 leading-tight">
              {tr.home.h1}
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 mb-10 max-w-xl mx-auto leading-relaxed">
              {tr.home.subtitle}
            </p>

            {/* Peek experience — the gateway */}
            <div className="max-w-2xl mx-auto mb-4">
              <PeekBox />
            </div>

            {user ? (
              <Link
                href="/wishes/my"
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center gap-1"
              >
                <span>{tr.home.myWishes}</span>
                <span>{forwardArrow(lang)}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {tr.home.ctaWrite}
              </Link>
            )}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────── */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
              {tr.home.howLabel}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <div key={i} className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof ──────────────────────────────── */}
        <section className="py-10 px-4 text-center">
          <p className="text-slate-500 text-base">{tr.home.proofText}</p>
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
