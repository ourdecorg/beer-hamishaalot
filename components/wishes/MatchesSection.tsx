'use client'

import { useEffect, useState } from 'react'
import type { MatchResult, MatchType } from '@/lib/types'

const matchTypeLabel: Record<MatchType, string> = {
  RESONANT:      '✦ הדהוד',
  COMPLEMENTARY: '◈ משלים',
  SIMILAR:       '◎ דומה',
}

const matchTypeBg: Record<MatchType, string> = {
  RESONANT:      'bg-amber-50 border-amber-200 text-amber-800',
  COMPLEMENTARY: 'bg-well-50 border-well-200 text-well-800',
  SIMILAR:       'bg-sand-100 border-sand-200 text-sand-700',
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
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [wishId])

  if (loading) {
    return (
      <div className="mt-10 card p-8 text-center">
        <div className="flex justify-center gap-1.5 mb-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-well-400" style={{ animation: `pulse-soft 1.2s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
        <p className="text-sand-500 text-sm">מחפש הדהודים…</p>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="mt-10 card p-10 text-center">
        <div className="text-3xl mb-3 opacity-40">✦</div>
        <p className="text-well-600 text-sm font-medium mb-1">טרם נמצאו משאלות מהדהדות</p>
        <p className="text-sand-400 text-xs">המנוע פועל ברקע — חזור מאוחר יותר</p>
      </div>
    )
  }

  return (
    <div className="mt-10 space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-sand-200" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-well-50 border border-well-200">
          <span className="text-well-600 text-sm">✦</span>
          <span className="text-xs font-semibold text-well-700">הדהודים שנמצאו</span>
          <span className="text-xs font-bold text-well-800 bg-well-100 px-2 py-0.5 rounded-full">
            {matches.length}
          </span>
        </div>
        <div className="h-px flex-1 bg-sand-200" />
      </div>

      {matches.map((match) => (
        <div key={match.connection_id} className="card p-6 space-y-4">
          {/* Header: type + score */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${matchTypeBg[match.match_type]}`}>
              {matchTypeLabel[match.match_type]}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-sand-400">ציון התאמה</span>
              <span
                className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #edf5f8, #d3e8f0)',
                  color: '#154963',
                }}
              >
                {Math.round(match.match_score * 100)}%
              </span>
            </div>
          </div>

          {/* Explanation */}
          {(match.explanation_text || match.match_summary) && (
            <p className="text-sm text-well-600 italic leading-relaxed">
              {match.explanation_text ?? match.match_summary}
            </p>
          )}

          {/* Matched wish text */}
          {match.matched_wish_text && (
            <div className="bg-sand-50 border border-sand-200 rounded-xl px-5 py-4">
              <p className="section-label text-xs mb-2">המשאלה התואמת</p>
              <p className="text-sm text-well-700 leading-relaxed">
                {match.matched_wish_text.length > 280
                  ? match.matched_wish_text.slice(0, 280) + '…'
                  : match.matched_wish_text}
              </p>
            </div>
          )}

          {/* Shared themes */}
          {match.shared_themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {match.shared_themes.map((theme) => (
                <span key={theme} className="tag-badge text-xs">{theme}</span>
              ))}
            </div>
          )}

          {/* Contact info */}
          {match.contact && (match.contact.name || match.contact.email || match.contact.phone) && (
            <div
              className="rounded-xl p-5 space-y-2"
              style={{ background: 'linear-gradient(145deg, #edf5f8, #d3e8f0)' }}
            >
              <p className="section-label mb-3">פרטי מבקש המשאלה</p>
              {match.contact.name && (
                <p className="text-well-800 font-semibold text-sm">{match.contact.name}</p>
              )}
              {match.contact.email && (
                <p className="text-sm" dir="ltr">
                  <a
                    href={`mailto:${match.contact.email}?subject=שיתוף פעולה — באר המשאלות`}
                    className="text-well-700 underline underline-offset-2 hover:text-well-500 font-medium"
                  >
                    {match.contact.email}
                  </a>
                </p>
              )}
              {match.contact.phone && (
                <p className="text-well-700 text-sm font-medium" dir="ltr">{match.contact.phone}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
