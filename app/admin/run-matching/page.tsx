'use client'

import { useState } from 'react'

export default function RunMatchingPage() {
  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState<{ message: string; started: number } | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)

  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{ message: string; started: number; missing: number } | null>(null)
  const [enrichError, setEnrichError] = useState<string | null>(null)

  async function handleRun() {
    setMatching(true)
    setMatchError(null)
    setMatchResult(null)

    try {
      const res = await fetch('/api/admin/run-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהפעלת matching')
      setMatchResult(data)
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : String(err))
    } finally {
      setMatching(false)
    }
  }

  async function handleEnrich() {
    setEnriching(true)
    setEnrichError(null)
    setEnrichResult(null)

    try {
      const res = await fetch('/api/admin/run-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהרצת enrichment')
      setEnrichResult(data)
    } catch (err: unknown) {
      setEnrichError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">הרצת MATCHES</h1>
        <p className="text-sm text-slate-500 mt-1">
          כלים להרצת pipeline ה-Matching ול-Enrichment על המשאלות.
        </p>
      </div>

      {/* Enrichment card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">🔬 Enrichment + Embedding</h2>
          <p className="text-xs text-slate-500 mt-1">
            מריץ ניתוח AI והטמעה רק על משאלות שחסר להן{' '}
            <code className="bg-slate-100 px-1 rounded">wish_enrichment</code> או{' '}
            <code className="bg-slate-100 px-1 rounded">wish_embeddings</code>.
          </p>
        </div>

        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          {enriching ? (
            <><span className="animate-spin inline-block">⟳</span> מעשיר...</>
          ) : (
            <>🔬 הרץ Enrichment על משאלות חסרות</>
          )}
        </button>

        {enrichResult && (
          <p className="text-sm font-medium text-emerald-700">✓ {enrichResult.message}</p>
        )}
        {enrichError && <p className="text-sm text-red-600">{enrichError}</p>}
      </div>

      {/* Matching card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">⚡ Matching Pipeline</h2>
          <p className="text-xs text-slate-500 mt-1">
            מפעיל את pipeline ה-Matching המלא על כל המשאלות הציבוריות. תוצאות יופיעו ב-
            <code className="bg-slate-100 px-1 rounded">wish_connections</code> בהדרגה.
          </p>
        </div>

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

        {matchResult && (
          <p className="text-sm text-emerald-700 font-medium">✓ {matchResult.message}</p>
        )}
        {matchError && <p className="text-sm text-red-600">{matchError}</p>}
      </div>

      {matchResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs text-slate-400 mb-2">לניטור ב-Supabase:</p>
          <pre className="text-xs bg-slate-100 rounded-lg p-3 whitespace-pre-wrap text-slate-700 font-mono" dir="ltr">{
`select wc.match_score, wc.match_type,
       mal.semantic_similarity,
       mal.complementarity_score,
       mal.structural_similarity
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
