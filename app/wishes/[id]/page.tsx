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

  // Fetch notes only for the wish owner (RLS enforces this server-side too)
  const notes = isOwner
    ? (await supabase.from('wish_notes').select('id, sender_name, sender_email, message, created_at').eq('wish_id', wish.id).order('created_at', { ascending: false })).data ?? []
    : []

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

        {/* Owner badge */}
        {isOwner && (
          <div className="mt-6 flex gap-3 flex-wrap">
            <div className="tag-badge">
              <span>{tr.yourWish}</span>
            </div>
          </div>
        )}

        {/* Notes (פתקים) — visible only to the wish owner */}
        {isOwner && notes.length > 0 && (
          <div className="mt-8">
            <p className="section-label mb-4">{tr.notesReceived(notes.length)}</p>
            <div className="flex flex-col gap-3">
              {notes.map(n => (
                <div key={n.id} className="card p-5 flex flex-col gap-2 text-right">
                  <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400 border-t border-slate-100 pt-2">
                    {n.sender_name  && <span>{n.sender_name}</span>}
                    {n.sender_email && (
                      <a href={`mailto:${n.sender_email}`} className="text-indigo-600 hover:underline">
                        {n.sender_email}
                      </a>
                    )}
                    <span className="ms-auto">
                      {new Date(n.created_at).toLocaleDateString(dateLocale(lang), {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
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
