import Link from 'next/link'
import type { WishWithResonance } from '@/lib/types'
import ResonanceButton from './ResonanceButton'

interface Props {
  wish: WishWithResonance
  isAuthenticated: boolean
  showFullText?: boolean
}

const visibilityLabel: Record<string, string> = {
  open: 'פתוח',
  anonymous: 'אנונימי',
  private: 'פרטי',
}

export default function WishCard({ wish, isAuthenticated, showFullText = false }: Props) {
  const displayText = wish.original_text

  const truncated =
    !showFullText && displayText.length > 220
      ? displayText.slice(0, 220) + '…'
      : displayText

  const formattedDate = new Date(wish.created_at).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article className="card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="section-label text-xs">
          {formattedDate}
        </span>
        <span className="tag-badge text-xs">
          {wish.visibility === 'anonymous' ? '🎭' : '✦'}{' '}
          {visibilityLabel[wish.visibility]}
        </span>
      </div>

      {/* Author email — only for open wishes */}
      {wish.visibility === 'open' && wish.user_email && (
        <div className="flex items-center gap-1.5 text-xs text-well-500">
          <span>✉</span>
          <span dir="ltr">{wish.user_email}</span>
        </div>
      )}

      {/* Text */}
      <p className="text-well-800 leading-relaxed text-base">
        {truncated}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-sand-100">
        <ResonanceButton
          wishId={wish.id}
          initialCount={wish.resonance_count}
          initialResonated={wish.user_has_resonated}
          isAuthenticated={isAuthenticated}
        />
        <Link
          href={`/wishes/${wish.id}`}
          className="text-sm text-well-500 hover:text-well-700 transition-colors"
        >
          קרא עוד ←
        </Link>
      </div>
    </article>
  )
}
