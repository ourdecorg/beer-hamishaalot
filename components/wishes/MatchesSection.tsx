'use client'

/**
 * MatchesSection — shown to wish owner below the wish detail.
 * Fetches matches from /api/wishes/[id]/matches and renders connection cards.
 * Handles the approve/reject flow inline.
 */
import { useEffect, useState } from 'react'
import type { MatchResult, MatchType, ConnectionStatus } from '@/lib/types'

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

const statusLabel: Record<ConnectionStatus, string> = {
  suggested: 'ממתין לאישורך',
  accepted_by_a: 'אישרת — ממתין לצד השני',
  connected: 'מחוברים ✓',
  rejected: 'דחית',
}

interface Props {
  wishId: string
}

export default function MatchesSection({ wishId }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/wishes/${wishId}/matches`)
      .then((r) => r.json())
      .then((data) => {
        setMatches(Array.isArray(data) ? data : [])
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [wishId])

  const handleAction = async (connectionId: string, action: 'approve' | 'reject') => {
    setActionLoading(connectionId)
    try {
      const res = await fetch(`/api/connections/${connectionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        setMatches((prev) =>
          prev.map((m) =>
            m.connection_id === connectionId
              ? { ...m, status: data.status as ConnectionStatus }
              : m
          )
        )
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setActionLoading(null)
    }
  }

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

            {/* Connected: reveal contact */}
            {match.status === 'connected' && match.contact && (
              <div className="bg-well-50 border border-well-200 rounded-xl p-4 mb-4 text-sm">
                <p className="section-label mb-2">פרטי קשר</p>
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              {match.status === 'suggested' && (
                <>
                  <button
                    onClick={() => handleAction(match.connection_id, 'approve')}
                    disabled={actionLoading === match.connection_id}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    {actionLoading === match.connection_id ? '…' : 'אשר חיבור'}
                  </button>
                  <button
                    onClick={() => handleAction(match.connection_id, 'reject')}
                    disabled={actionLoading === match.connection_id}
                    className="btn-ghost text-sm text-sand-500"
                  >
                    דחה
                  </button>
                </>
              )}
              {match.status !== 'suggested' && (
                <span className="text-xs text-sand-500">{statusLabel[match.status]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
