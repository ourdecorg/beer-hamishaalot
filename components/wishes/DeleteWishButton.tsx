'use client'

import { useState } from 'react'

export default function DeleteWishButton({ wishId }: { wishId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError(false)
    const res = await fetch(`/api/wishes/${wishId}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.reload()
    } else {
      setLoading(false)
      setError(true)
    }
  }

  if (confirming) {
    return (
      <span
        className="flex items-center gap-2"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        <span className="text-sm text-red-600 font-medium">למחוק את המשאלה?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-semibold px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? '…' : 'מחק'}
        </button>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false); setError(false) }}
          disabled={loading}
          className="text-sm px-3 py-1 rounded-lg border border-sand-200 text-sand-500 hover:bg-sand-50"
        >
          ביטול
        </button>
        {error && <span className="text-xs text-red-500">שגיאה, נסה שוב</span>}
      </span>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      מחק
    </button>
  )
}
