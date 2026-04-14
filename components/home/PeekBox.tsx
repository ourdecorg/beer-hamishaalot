'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type BoxState = 'idle' | 'loading' | 'results' | 'empty'

interface PeekResult {
  wish_id:            string
  text:               string
  similarity:         number
  emotional_tone:     string | null
  collaboration_type: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = ['מקשיב…', 'הבאר מגיב…', 'משהו מתגבש…']

const COLLAB_LABELS: Record<string, string> = {
  build: 'בנייה', learn: 'למידה', connect: 'חיבור', support: 'תמיכה', share: 'שיתוף',
}

const MIN_LENGTH   = 10
const MIN_DELAY_MS = 1500

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeekBox() {
  const [boxState, setBoxState] = useState<BoxState>('idle')
  const [input,    setInput]    = useState('')
  const [results,  setResults]  = useState<PeekResult[]>([])
  const [error,    setError]    = useState<string | null>(null)
  const [msgIdx,   setMsgIdx]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rotate loading messages
  useEffect(() => {
    if (boxState === 'loading') {
      timerRef.current = setInterval(
        () => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length),
        600,
      )
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setMsgIdx(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [boxState])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (trimmed.length < MIN_LENGTH) {
      setError('נסה לכתוב מחשבה מלאה יותר')
      return
    }
    setError(null)
    setBoxState('loading')
    const start = Date.now()

    try {
      const res  = await fetch('/api/peek', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()

      // Enforce minimum UX delay — the resonance should feel intentional
      const elapsed = Date.now() - start
      if (elapsed < MIN_DELAY_MS) {
        await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed))
      }

      if (!res.ok) throw new Error(data.error ?? 'שגיאה')

      if (data.results?.length) {
        setResults(data.results)
        setBoxState('results')
      } else {
        setBoxState('empty')
      }
    } catch (err: unknown) {
      setBoxState('idle')
      setError(err instanceof Error ? err.message : 'שגיאה — נסה שוב')
    }
  }

  function handleReset() {
    setBoxState('idle')
    setResults([])
    setInput('')
    setError(null)
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (boxState === 'idle' || boxState === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
            placeholder="כתוב מחשבה… לא בהכרח משאלה"
            disabled={boxState === 'loading'}
            rows={3}
            className="w-full px-5 py-4 text-slate-900 placeholder:text-slate-400 text-base
                       leading-relaxed resize-none focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            {boxState === 'loading' ? (
              /* Loading: dots + rotating message */
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-slate-500">{LOADING_MESSAGES[msgIdx]}</span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">שחרר מחשבה אל הבאר</p>
            )}

            {boxState === 'idle' && (
              <button
                onClick={handleSubmit}
                disabled={input.trim().length < MIN_LENGTH}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500
                           disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold
                           rounded-lg transition-all active:scale-95"
              >
                זרוק לבאר
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      </div>
    )
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (boxState === 'empty') {
    return (
      <div className="text-center space-y-4 py-6">
        <p className="text-slate-500">לא הדהד כלום הפעם… נסה מחשבה אחרת</p>
        <button
          onClick={handleReset}
          className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          ← חזור
        </button>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 text-right">
      <p className="text-base font-medium text-slate-700">
        המשאלות האלה הדהדו עם המחשבה שלך
      </p>

      <div className="flex flex-col gap-4">
        {results.map(r => (
          <div
            key={r.wish_id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 text-right"
          >
            <p className="text-slate-800 text-base leading-relaxed">{r.text}</p>

            {(r.collaboration_type || r.emotional_tone) && (
              <div className="flex gap-2 flex-wrap">
                {r.collaboration_type && (
                  <span className="tag-badge text-xs">
                    {COLLAB_LABELS[r.collaboration_type] ?? r.collaboration_type}
                  </span>
                )}
                {r.emotional_tone && (
                  <span className="tag-badge text-xs bg-amber-50 text-amber-700 border-amber-200">
                    {r.emotional_tone}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1 items-center">
              <Link
                href="/login"
                className="btn-primary w-full justify-center text-sm py-2.5 rounded-xl"
              >
                השאר הערה
              </Link>
              <p className="text-xs text-slate-400">להתחבר, כנס לבאר</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleReset}
        className="text-sm text-slate-400 hover:text-slate-600 transition-colors text-center"
      >
        ← נסה מחשבה אחרת
      </button>
    </div>
  )
}
