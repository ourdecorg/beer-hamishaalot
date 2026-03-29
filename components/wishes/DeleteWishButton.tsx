'use client'

import { useState } from 'react'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'

export default function DeleteWishButton({ wishId }: { wishId: string }) {
  const lang = useLang()
  const tr = t(lang).deleteWish

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
        <span className="text-sm text-red-600 font-medium">{tr.confirm}</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-semibold px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? '…' : tr.delete}
        </button>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false); setError(false) }}
          disabled={loading}
          className="text-sm px-3 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          {tr.cancel}
        </button>
        {error && <span className="text-xs text-red-500">{tr.error}</span>}
      </span>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      {tr.delete}
    </button>
  )
}
