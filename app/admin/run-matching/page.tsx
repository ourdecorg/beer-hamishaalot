'use client'

import { useState } from 'react'

export default function RunMatchingPage() {
  const [matching, setMatching] = useState(false)
  const [result, setResult] = useState<{ message: string; started: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setMatching(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/run-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהפעלת matching')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-well-900" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
          הרצת MATCHES
        </h1>
        <p className="text-sm text-well-500 mt-1">
          מפעיל את pipeline ה-Matching על כל המשאלות הציבוריות.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-4">
        <p className="text-xs text-well-500">
          התהליך רץ ברקע — תוצאות יופיעו ב-<code className="bg-sand-100 px-1 rounded">wish_connections</code> בהדרגה.
        </p>

        <button
          onClick={handleRun}
          disabled={matching}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          {matching ? (
            <><span className="animate-spin inline-block">⟳</span> מפעיל...</>
          ) : (
            <>⚡ הפעל matching על כל המשאלות הציבוריות</>
          )}
        </button>

        {result && (
          <p className="text-sm text-emerald-700 font-medium">✓ {result.message}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
          <p className="text-xs text-well-400 mb-2">לניטור ב-Supabase:</p>
          <pre className="text-xs bg-sand-100 rounded-lg p-3 whitespace-pre-wrap text-well-700 font-mono" dir="ltr">{
`select wc.match_score, wc.match_type,
       mal.intent_compatibility
from wish_connections wc
join match_attempts_log mal
  on mal.wish_id = wc.wish_a or mal.wish_id = wc.wish_b
order by wc.created_at desc
limit 20;`
          }</pre>
        </div>
      )}
    </div>
  )
}
