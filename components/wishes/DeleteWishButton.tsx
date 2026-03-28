'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteWishButton({ wishId }: { wishId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    await fetch(`/api/wishes/${wishId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
        <span className="text-xs text-red-600">למחוק?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          {loading ? '…' : 'כן'}
        </button>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
          className="text-xs px-2 py-0.5 rounded bg-sand-100 text-sand-500 hover:bg-sand-200"
        >
          ביטול
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="text-xs text-sand-300 hover:text-red-400 transition-colors"
      title="מחק משאלה"
    >
      🗑
    </button>
  )
}
