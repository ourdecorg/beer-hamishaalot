'use client'

import { useRef, useState } from 'react'

type LoadResult = {
  created: number
  errors: number
  wishIds: string[]
  details?: { email: string; error: string }[]
}

export default function TestDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LoadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('נא לבחור קובץ CSV'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/load-test-data', { method: 'POST', body: fd })
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
        <h1 className="text-2xl font-bold text-slate-900">טעינת TEST DATA</h1>
        <p className="text-sm text-slate-500 mt-1">טען קובץ CSV של משאלות לסביבת הפיתוח.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <p className="text-xs text-slate-500">
          פורמט עמודות: שם, עיר, אזור, מספר בית, טלפון, אימייל, משאלה
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-700 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
          />
          <button
            onClick={handleUpload}
            disabled={loading}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'העלה וצור משאלות'}
          </button>
        </div>

        {result && (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-700 font-medium">✓ נוצרו: {result.created} משאלות</span>
              {result.errors > 0 && (
                <span className="text-red-600 font-medium">✗ שגיאות: {result.errors}</span>
              )}
            </div>
            {result.details && result.details.length > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer">פרטי שגיאות</summary>
                <ul className="mt-1 space-y-0.5 pr-3">
                  {result.details.map((d, i) => (
                    <li key={i}>{d.email}: {d.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
