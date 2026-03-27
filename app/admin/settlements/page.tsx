'use client'

import { useRef, useState } from 'react'

export default function SettlementsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSeed() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('נא לבחור קובץ CSV'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/seed-settlements', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בטעינה')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-well-900" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
          טעינת טבלת ישובים
        </h1>
        <p className="text-sm text-well-500 mt-1">
          קובץ CSV של ישובים מאתר הלמ&quot;ס — נטען לטבלת{' '}
          <code className="bg-sand-100 px-1 rounded">settlements</code>{' '}
          ומשמש לבחירת ישוב בטופס המשאלות.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-4">
        <p className="text-xs text-well-500">
          הקובץ מקודד בـ Windows-1255 (ברירת מחדל של הלמ&quot;ס). ניתן להוריד מ:{' '}
          <span className="font-mono text-sand-500">cbs.gov.il → גאוגרפיה → ישובים</span>
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-well-700 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-sand-300 file:text-sm file:bg-sand-50 file:text-well-700 hover:file:bg-sand-100"
          />
          <button
            onClick={handleSeed}
            disabled={loading}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'טען ישובים'}
          </button>
        </div>

        {result && (
          <p className="text-sm text-emerald-700 font-medium">
            ✓ נטענו {result.inserted.toLocaleString()} ישובים בהצלחה
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
