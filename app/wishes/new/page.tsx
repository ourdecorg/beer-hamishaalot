import Header from '@/components/layout/Header'
import WishForm from '@/components/wishes/WishForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { t } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'

export async function generateMetadata() {
  const lang = await getLang()
  return { title: t(lang).newWish.pageTitle }
}

interface Props {
  searchParams: { q?: string }
}

export default async function NewWishPage({ searchParams }: Props) {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang).newWish
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const q = searchParams?.q
    const next = q ? `/wishes/new?q=${encodeURIComponent(q)}` : '/wishes/new'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const initialText = searchParams?.q ?? ''

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {tr.heading}
          </h1>
          <p className="text-slate-500">{tr.subheading}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <WishForm initialText={initialText} />
        </div>

        <div className="mt-6 flex gap-3 items-start bg-slate-50 border border-slate-200 rounded-xl p-4">
          <span className="text-slate-400 flex-shrink-0 mt-0.5">ℹ</span>
          <p className="text-sm text-slate-600 leading-relaxed">{tr.infoNote}</p>
        </div>
      </main>
    </div>
  )
}
