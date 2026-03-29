import Link from 'next/link'
import type { WishWithResonance } from '@/lib/types'
import ResonanceButton from './ResonanceButton'
import { dateLocale, type Lang } from '@/lib/i18n'

interface Props {
  wish: WishWithResonance
  isAuthenticated: boolean
  showFullText?: boolean
  lang: Lang
  readMoreLabel: string
}

export default function WishCard({ wish, isAuthenticated, showFullText = false, lang, readMoreLabel }: Props) {
  const displayText = wish.original_text

  const truncated =
    !showFullText && displayText.length > 220
      ? displayText.slice(0, 220) + '…'
      : displayText

  const formattedDate = new Date(wish.created_at).toLocaleDateString(dateLocale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article className="card-hover p-6 flex flex-col gap-4">
      <div className="w-6 h-0.5 bg-amber-400 rounded-full" />

      <div className="flex items-center justify-between gap-2">
        <span className="section-label text-xs">{formattedDate}</span>
      </div>

      {wish.user_email && (
        <div className="flex items-center gap-1.5 text-xs text-well-500">
          <span>✉</span>
          <span dir="ltr">{wish.user_email}</span>
        </div>
      )}

      <p className="text-well-800 leading-relaxed text-base flex-1">{truncated}</p>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-sand-100">
        <ResonanceButton
          wishId={wish.id}
          initialCount={wish.resonance_count}
          initialResonated={wish.user_has_resonated}
          isAuthenticated={isAuthenticated}
        />
        <Link
          href={`/wishes/${wish.id}`}
          className="text-sm font-medium text-well-500 hover:text-well-700 transition-colors inline-flex items-center gap-1"
        >
          <span>{readMoreLabel}</span>
          <span>←</span>
        </Link>
      </div>
    </article>
  )
}
