'use client'

/**
 * MatchesSection — shown to wish owner below the wish detail.
 * Fetches matches from /api/wishes/[id]/matches and renders connection cards.
 * All matches are immediately connected — no approval required.
 */
import { useEffect, useState } from 'react'
import type { MatchResult, MatchType } from '@/lib/types'

const matchTypeLabel: Record<MatchType, string> = {
  RESONANT: '✦ הדהוד',
  COMPLEMENTARY: '◈ משלים',
  SIMILAR: '◎ דומה',
}

const matchTypeBg: Record<MatchType, string> = {
  RESONANT: 'bg-amber-50 border-amber-200 text-amber-800',
  COMPLEMENTARY: 'bg-well-50 border-well-200 text-well-800',
  SIMILAR: 'bg-sand-100 border-sand-200 text-sand-700',
}

interface Props {
  wishId: string
}

export default function MatchesSection({ wishId }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/wishes/${wishId}/matches`)
      .then((r) => r.json())
      .then((data) => {
        setMatches(Array.isArray(data) ? data : [])
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [wishId])

  if (loading) {
    return (
      <div className="mt-10 card p-6 text-center text-sand-400 text-sm animate-pulse">
        ✦ מחפש הדהודים…
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="mt-10 card p-6 text-center text-sand-400 text-sm">
        <p>טרם נמצאו משאלות מהדהדות.</p>
        <p className="text-xs mt-1 text-sand-300">המנוע פועל ברקע — חזור מאוחר יותר</p>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <p className="section-label mb-4">
        <span className="text-well-500">✦</span> הדהודים שנמצאו
      </p>

      <div className="space-y-4">
        {matches.map((match) => (
          <div key={match.connection_id} className="card p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${matchTypeBg[match.match_type]}`}>
                {matchTypeLabel[match.match_type]}
              </span>
              <span className="text-xs text-sand-400">
                התאמה: <strong className="text-well-700">{Math.round(match.match_score * 100)}%</strong>
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm text-well-700 mb-3">{match.match_summary}</p>

            {/* Shared themes */}
            {match.shared_themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {match.shared_themes.map((theme) => (
                  <span key={theme} className="tag-badge text-xs">{theme}</span>
                ))}
              </div>
            )}

            {/* Contact info — always visible */}
            {match.contact && (match.contact.name || match.contact.email || match.contact.phone) && (
              <div className="bg-well-50 border border-well-200 rounded-xl p-4 text-sm">
                <p className="section-label mb-2">פרטי קשר לשיתוף פעולה</p>
                {match.contact.name && <p className="text-well-800 font-medium">{match.contact.name}</p>}
                {match.contact.email && (
                  <p className="text-well-700" dir="ltr">
                    <a href={`mailto:${match.contact.email}`} className="underline hover:no-underline">
                      {match.contact.email}
                    </a>
                  </p>
                )}
                {match.contact.phone && <p className="text-well-700" dir="ltr">{match.contact.phone}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
