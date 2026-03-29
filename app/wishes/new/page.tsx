import Header from '@/components/layout/Header'
import WishForm from '@/components/wishes/WishForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLang, t } from '@/lib/i18n'

export async function generateMetadata() {
  const lang = await getLang()
  return { title: t(lang).newWish.pageTitle }
}

export default async function NewWishPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang).newWish
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wishes/new')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-sand-50 to-white">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Page header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ background: 'linear-gradient(145deg, #1c5f7a, #0b2d41)', boxShadow: '0 8px 24px rgba(21,73,99,0.25)' }}
          >
            <span className="text-xl text-amber-300">✦</span>
          </div>
          <h1
            className="text-3xl font-bold text-well-900 mb-2"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            {tr.heading}
          </h1>
          <p className="text-well-500">{tr.subheading}</p>
        </div>

        <div className="card p-8">
          <WishForm />
        </div>

        <div className="mt-6 flex gap-3 items-start bg-well-50/80 border border-well-200/60 rounded-xl p-4">
          <span className="text-well-400 flex-shrink-0 mt-0.5">ℹ</span>
          <p className="text-sm text-well-600 leading-relaxed">{tr.infoNote}</p>
        </div>
      </main>
    </div>
  )
}
