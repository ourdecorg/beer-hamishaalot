'use client'

import { useRef, useState } from 'react'

export default function CountriesPage() {
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
      const res = await fetch('/api/admin/seed-countries', { method: 'POST', body: fd })
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
        <h1 className="text-2xl font-bold text-slate-900">טעינת טבלת ארצות</h1>
        <p className="text-sm text-slate-500 mt-1">
          קובץ CSV של ארצות בפורמט ISO 3166-1 — נטען לטבלת{' '}
          <code className="bg-slate-100 px-1 rounded text-slate-600">countries</code>{' '}
          ומשמש לבחירת ארץ בטופס המשאלות.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <p className="text-xs text-slate-500">
          פורמט: <code className="font-mono bg-slate-100 px-1 rounded">id,alpha2,alpha3,name</code> · קידוד UTF-8
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-700 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
          />
          <button
            onClick={handleSeed}
            disabled={loading}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'טען ארצות'}
          </button>
        </div>

        {result && (
          <p className="text-sm text-emerald-700 font-medium">
            ✓ נטענו {result.inserted.toLocaleString()} ארצות בהצלחה
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
