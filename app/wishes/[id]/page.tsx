import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ResonanceButton from '@/components/wishes/ResonanceButton'
import MatchesSection from '@/components/wishes/MatchesSection'
import { createClient } from '@/lib/supabase/server'
import type { WishWithResonance } from '@/lib/types'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  return {
    title: 'משאלה — באר המשאלות',
  }
}

export default async function WishPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the wish
  const { data: wish, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !wish) notFound()

  // Access control: private wishes only visible to owner
  if (wish.visibility === 'private' && wish.user_id !== user?.id) {
    notFound()
  }

  // Get resonance count
  const { count: resonanceCount } = await supabase
    .from('wish_resonances')
    .select('*', { count: 'exact', head: true })
    .eq('wish_id', wish.id)

  // Check if current user has resonated
  let userHasResonated = false
  if (user) {
    const { data: ownResonance } = await supabase
      .from('wish_resonances')
      .select('id')
      .eq('wish_id', wish.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userHasResonated = !!ownResonance
  }

  const wishWithResonance: WishWithResonance = {
    ...wish,
    resonance_count: resonanceCount ?? 0,
    user_has_resonated: userHasResonated,
  }

  const isOwner = user?.id === wish.user_id
  const canResonate = ['anonymous', 'open'].includes(wish.visibility) && !isOwner

  const formattedDate = new Date(wish.created_at).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const visibilityLabel: Record<string, string> = {
    open: '✦ פתוח',
    anonymous: '🎭 אנונימי',
    private: '🔒 פרטי',
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 fade-in">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/wishes/feed"
            className="text-sm text-sand-400 hover:text-well-600 transition-colors inline-flex items-center gap-1"
          >
            → חזרה לבאר
          </Link>
        </div>

        {/* Wish Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <p className="section-label">{formattedDate}</p>
          <span className="tag-badge text-sm">{visibilityLabel[wish.visibility]}</span>
        </div>

        {/* Original Text */}
        <div className="card p-8 mb-6">
          <p className="section-label mb-4">המשאלה המקורית</p>
          <p className="text-well-800 text-xl leading-relaxed whitespace-pre-wrap">
            {wish.original_text}
          </p>
        </div>

        {/* AI Enrichment */}
        {wish.is_ai_enriched ? (
          <div className="space-y-5">
            {/* Summary */}
            {wish.ai_summary && (
              <div className="card p-8">
                <p className="section-label mb-4">
                  <span className="text-amber-500">✦</span> תמצית פיוטית
                </p>
                <p className="text-well-700 leading-relaxed text-lg italic">
                  {wish.ai_summary}
                </p>
              </div>
            )}

            {/* Intention */}
            {wish.intention_statement && (
              <div className="card p-8 bg-gradient-to-br from-well-50 to-white">
                <p className="section-label mb-4">
                  <span className="text-well-500">◈</span> משפט הכוונה
                </p>
                <blockquote className="text-well-800 text-lg leading-relaxed border-r-4 border-amber-400 pr-4">
                  {wish.intention_statement}
                </blockquote>
              </div>
            )}

            {/* Tags */}
            {wish.ai_tags && wish.ai_tags.length > 0 && (
              <div className="card p-6">
                <p className="section-label mb-4">נושאים</p>
                <div className="flex flex-wrap gap-2">
                  {wish.ai_tags.map((tag: string) => (
                    <span key={tag} className="tag-badge">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-sand-400">
            <p className="text-sm">
              ✦ הבינה המלאכותית עדיין מעבדת את המשאלה…
            </p>
          </div>
        )}

        {/* Contact info — open wishes only */}
        {wish.visibility === 'open' && wish.contact_name && (
          <div className="card p-6 mt-6">
            <p className="section-label mb-4">
              <span className="text-well-500">◎</span> פרטי קשר
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-sand-400 mb-0.5">שם</dt>
                <dd className="text-well-800 font-medium">{wish.contact_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-sand-400 mb-0.5">אימייל</dt>
                <dd className="text-well-800 font-medium" dir="ltr">{wish.contact_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-sand-400 mb-0.5">ארץ</dt>
                <dd className="text-well-800">{wish.contact_country}</dd>
              </div>
              <div>
                <dt className="text-xs text-sand-400 mb-0.5">ישוב</dt>
                <dd className="text-well-800">{wish.contact_city}</dd>
              </div>
              {wish.contact_address && (
                <div>
                  <dt className="text-xs text-sand-400 mb-0.5">כתובת</dt>
                  <dd className="text-well-800">{wish.contact_address}</dd>
                </div>
              )}
              {wish.contact_phone && (
                <div>
                  <dt className="text-xs text-sand-400 mb-0.5">טלפון</dt>
                  <dd className="text-well-800" dir="ltr">{wish.contact_phone}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Resonance */}
        {canResonate && (
          <div className="mt-8 card p-6 text-center">
            <p className="text-well-600 mb-4 text-sm">
              משאלה זו נוגעת בך?
            </p>
            <ResonanceButton
              wishId={wish.id}
              initialCount={wishWithResonance.resonance_count}
              initialResonated={wishWithResonance.user_has_resonated}
              isAuthenticated={!!user}
            />
            {wishWithResonance.resonance_count > 0 && (
              <p className="text-xs text-sand-400 mt-3">
                {wishWithResonance.resonance_count} {wishWithResonance.resonance_count === 1 ? 'אדם' : 'אנשים'} מהדהדים
              </p>
            )}
          </div>
        )}

        {/* Owner actions */}
        {isOwner && (
          <div className="mt-6 flex gap-3 flex-wrap">
            <div className="tag-badge">
              <span>זו המשאלה שלך</span>
            </div>
            {wishWithResonance.resonance_count > 0 && (
              <div className="tag-badge text-amber-700 bg-amber-50 border-amber-200">
                <span>💛</span>
                <span>{wishWithResonance.resonance_count} אנשים מהדהדים</span>
              </div>
            )}
          </div>
        )}

        {/* Resonance Engine matches — owner only, non-private wishes */}
        {isOwner && wish.visibility !== 'private' && (
          <MatchesSection wishId={wish.id} />
        )}
      </main>

      <Footer />
    </div>
  )
}
