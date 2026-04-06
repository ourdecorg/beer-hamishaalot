import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import MatchesSection from '@/components/wishes/MatchesSection'
import { createClient } from '@/lib/supabase/server'
import { t, dateLocale } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'

interface Props {
  params: { id: string }
}

export async function generateMetadata(_: Props) {
  const lang = await getLang()
  return { title: t(lang).wishDetail.pageTitle }
}

export default async function WishPage({ params }: Props) {
  const [supabase, lang] = await Promise.all([createClient(), getLang()])
  const tr = t(lang).wishDetail

  const { data: { user } } = await supabase.auth.getUser()

  const { data: wish, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !wish) notFound()

  const isOwner = user?.id === wish.user_id
  const isAdmin = !!(user?.email && user.email === process.env.ADMIN_EMAIL)

  const formattedDate = new Date(wish.created_at).toLocaleDateString(dateLocale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 fade-in">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <p className="section-label">{formattedDate}</p>
        </div>

        {/* Original Text */}
        <div className="card p-8 mb-8">
          <p className="section-label mb-4">{tr.originalWish}</p>
          <p className="text-slate-800 text-xl leading-relaxed whitespace-pre-wrap">
            {wish.original_text}
          </p>
        </div>

        {/* Contact info */}
        {wish.contact_name && (
          <div className="card p-6 mt-6 bg-slate-50">
            <p className="section-label mb-4">
              {tr.contactDetails}
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">{tr.nameLabel}</dt>
                <dd className="text-slate-800 font-medium">{wish.contact_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">{tr.emailLabel}</dt>
                <dd className="text-slate-800 font-medium" dir="ltr">{wish.contact_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">{tr.cityLabel}</dt>
                <dd className="text-slate-800">{wish.contact_city}</dd>
              </div>
              {wish.contact_address && (
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">{tr.addressLabel}</dt>
                  <dd className="text-slate-800">{wish.contact_address}</dd>
                </div>
              )}
              {wish.contact_phone && (
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">{tr.phoneLabel}</dt>
                  <dd className="text-slate-800" dir="ltr">{wish.contact_phone}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Owner badge */}
        {isOwner && (
          <div className="mt-6 flex gap-3 flex-wrap">
            <div className="tag-badge">
              <span>{tr.yourWish}</span>
            </div>
          </div>
        )}

        {(isOwner || isAdmin) && (
          <MatchesSection wishId={wish.id} isAdmin={isAdmin} />
        )}
      </main>

    </div>
  )
}
