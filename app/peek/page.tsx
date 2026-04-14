'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type PageState = 'idle' | 'loading' | 'results' | 'empty'

interface PeekResult {
  wish_id:            string
  text:               string
  similarity:         number
  emotional_tone:     string | null
  collaboration_type: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'מקשיב…',
  'הבאר מגיב…',
  'משהו מתגבש…',
]

const COLLAB_LABELS: Record<string, string> = {
  build:   'בנייה',
  learn:   'למידה',
  connect: 'חיבור',
  support: 'תמיכה',
  share:   'שיתוף',
}

const MIN_INPUT_LENGTH  = 10
const MIN_UX_DELAY_MS   = 1500

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeekPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [input,     setInput]     = useState('')
  const [results,   setResults]   = useState<PeekResult[]>([])
  const [error,     setError]     = useState<string | null>(null)
  const [msgIndex,  setMsgIndex]  = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rotate loading messages while in loading state
  useEffect(() => {
    if (pageState === 'loading') {
      intervalRef.current = setInterval(
        () => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length),
        600,
      )
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setMsgIndex(0)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [pageState])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (trimmed.length < MIN_INPUT_LENGTH) {
      setError('נסה לכתוב מחשבה מלאה יותר')
      return
    }

    setError(null)
    setPageState('loading')
    const start = Date.now()

    try {
      const res  = await fetch('/api/peek', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()

      // Enforce minimum UX delay — the magic should feel intentional
      const elapsed = Date.now() - start
      if (elapsed < MIN_UX_DELAY_MS) {
        await new Promise(r => setTimeout(r, MIN_UX_DELAY_MS - elapsed))
      }

      if (!res.ok) throw new Error(data.error ?? 'שגיאה')

      if (data.results?.length) {
        setResults(data.results)
        setPageState('results')
      } else {
        setPageState('empty')
      }
    } catch (err: unknown) {
      setPageState('idle')
      setError(err instanceof Error ? err.message : 'שגיאה — נסה שוב')
    }
  }

  function handleReset() {
    setPageState('idle')
    setResults([])
    setInput('')
    setError(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">

      {/* ── Idle + Loading: input area ──────────────────────────────────────── */}
      {(pageState === 'idle' || pageState === 'loading') && (
        <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">הצץ לבאר</h1>
            <p className="text-slate-500 text-base leading-relaxed">
              שחרר משפט אל תוך הבאר וראה מה מהדהד חזרה
            </p>
          </div>

          <div className="w-full space-y-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="כתוב מחשבה… לא בהכרח משאלה"
              disabled={pageState === 'loading'}
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-5 py-4
                         text-base text-slate-800 placeholder-slate-400 shadow-sm
                         focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {pageState === 'idle' && (
              <button
                onClick={handleSubmit}
                disabled={input.trim().length < MIN_INPUT_LENGTH}
                className="btn-primary w-full justify-center py-3 text-base rounded-2xl
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              >
                זרוק לבאר
              </button>
            )}

            {pageState === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-3">
                {/* Bouncing dots */}
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  {LOADING_MESSAGES[msgIndex]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {pageState === 'results' && (
        <div className="w-full max-w-lg flex flex-col gap-6">

          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-800">
              המשאלות האלה הדהדו עם המחשבה שלך
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {results.map(r => (
              <ResultCard key={r.wish_id} result={r} />
            ))}
          </div>

          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-slate-600 text-center transition-colors"
          >
            ← נסה מחשבה אחרת
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {pageState === 'empty' && (
        <div className="text-center space-y-5">
          <p className="text-slate-500 text-base">
            לא הדהד כלום הפעם… נסה מחשבה אחרת
          </p>
          <button
            onClick={handleReset}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← חזור
          </button>
        </div>
      )}

    </main>
  )
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: PeekResult }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">

      <p className="text-slate-800 text-base leading-relaxed">
        {result.text}
      </p>

      {/* Optional metadata badges */}
      {(result.collaboration_type || result.emotional_tone) && (
        <div className="flex gap-2 flex-wrap">
          {result.collaboration_type && (
            <span className="tag-badge text-xs">
              {COLLAB_LABELS[result.collaboration_type] ?? result.collaboration_type}
            </span>
          )}
          {result.emotional_tone && (
            <span className="tag-badge text-xs bg-amber-50 text-amber-700 border-amber-200">
              {result.emotional_tone}
            </span>
          )}
        </div>
      )}

      {/* CTA — triggers login */}
      <div className="flex flex-col gap-1.5 items-center">
        <Link
          href="/login"
          className="btn-primary w-full justify-center text-sm py-2.5 rounded-xl"
        >
          השאר הערה
        </Link>
        <p className="text-xs text-slate-400">
          להתחבר, כנס לבאר
        </p>
      </div>
    </div>
  )
}
