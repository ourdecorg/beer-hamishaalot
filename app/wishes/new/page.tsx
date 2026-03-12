import Header from '@/components/layout/Header'
import WishForm from '@/components/wishes/WishForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'משאלה חדשה — באר המשאלות',
}

export default async function NewWishPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wishes/new')
  }

  return (
    <div className="flex flex-col min-h-screen bg-sand-50">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-well-800 shadow mb-4">
            <span className="text-xl text-amber-300">✦</span>
          </div>
          <h1
            className="text-3xl font-bold text-well-900 mb-2"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            שלח משאלה
          </h1>
          <p className="text-well-500">
            שתף את מה שנמצא בלבך. הבאר מקשיבה.
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <WishForm />
        </div>

        {/* Info note */}
        <div className="mt-6 flex gap-3 items-start bg-well-50 border border-well-200 rounded-xl p-4">
          <span className="text-well-400 flex-shrink-0 mt-0.5">ℹ</span>
          <p className="text-sm text-well-600 leading-relaxed">
            לאחר השליחה, קלוד יעצב עבורך סיכום פיוטי, תגיות, ומשפט כוונה — כדי לסייע לך להבין את עומק משאלתך.
          </p>
        </div>
      </main>
    </div>
  )
}
