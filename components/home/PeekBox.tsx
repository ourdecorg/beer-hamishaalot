'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type BoxState = 'idle' | 'loading' | 'results' | 'empty'

interface PeekResult {
  wish_id:            string
  text:               string
  similarity:         number
  emotional_tone:     string | null
  collaboration_type: string | null
}

interface NoteForm {
  name:    string
  email:   string
  message: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = ['מקשיב…', 'הבאר מגיב…', 'מחפש הדהודים…']

const COLLAB_LABELS: Record<string, string> = {
  build: 'בנייה', learn: 'למידה', connect: 'חיבור', support: 'תמיכה', share: 'שיתוף',
}

const MIN_LENGTH   = 10
const MIN_DELAY_MS = 1500

const EMPTY_NOTE: NoteForm = { name: '', email: '', message: '' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeekBox() {
  const [boxState, setBoxState] = useState<BoxState>('idle')
  const [input,    setInput]    = useState('')
  const [results,  setResults]  = useState<PeekResult[]>([])
  const [error,    setError]    = useState<string | null>(null)
  const [msgIdx,   setMsgIdx]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Note form state
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null)
  const [noteForm,    setNoteForm]    = useState<NoteForm>(EMPTY_NOTE)
  const [noteSending, setNoteSending] = useState(false)
  const [noteSentIds, setNoteSentIds] = useState<Set<string>>(new Set())
  const [noteError,   setNoteError]   = useState<string | null>(null)

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
    setNoteOpenFor(null)
    setNoteForm(EMPTY_NOTE)
    setNoteSentIds(new Set())
    setNoteError(null)
  }

  function openNote(wishId: string) {
    setNoteOpenFor(wishId)
    setNoteForm(EMPTY_NOTE)
    setNoteError(null)
  }

  async function handleSendNote(wishId: string) {
    if (!noteForm.message.trim()) {
      setNoteError('נא לכתוב פתק')
      return
    }
    setNoteSending(true)
    setNoteError(null)
    try {
      const res = await fetch(`/api/wishes/${wishId}/notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:      noteForm.message,
          sender_name:  noteForm.name,
          sender_email: noteForm.email,
        }),
      })
      if (!res.ok) throw new Error()
      setNoteSentIds(prev => new Set([...prev, wishId]))
      setNoteOpenFor(null)
    } catch {
      setNoteError('שגיאה — נסה שוב')
    } finally {
      setNoteSending(false)
    }
  }

  // ── Idle / Loading ─────────────────────────────────────────────────────────
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
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500
                           text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
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
        {results.map(r => {
          const sent      = noteSentIds.has(r.wish_id)
          const noteOpen  = noteOpenFor === r.wish_id

          return (
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

              {/* Note action area */}
              {sent ? (
                <p className="text-sm text-green-600 font-medium text-center py-1">
                  ✓ הפתק נשלח לבעל המשאלה
                </p>
              ) : noteOpen ? (
                /* Inline note form */
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-1">השאר פתק לבעל המשאלה</p>

                  <input
                    type="text"
                    placeholder="שמך (לא חובה)"
                    value={noteForm.name}
                    onChange={e => setNoteForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    type="email"
                    placeholder="אימייל ליצירת קשר (לא חובה)"
                    value={noteForm.email}
                    onChange={e => setNoteForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <textarea
                    placeholder="כתוב פתק לבעל המשאלה…"
                    value={noteForm.message}
                    onChange={e => setNoteForm(f => ({ ...f, message: e.target.value }))}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                               resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />

                  {noteError && (
                    <p className="text-xs text-red-500">{noteError}</p>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setNoteOpenFor(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={() => handleSendNote(r.wish_id)}
                      disabled={noteSending}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600
                                 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg
                                 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {noteSending ? 'שולח…' : 'שלח פתק'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Default CTA */
                <button
                  onClick={() => openNote(r.wish_id)}
                  className="w-full py-2.5 rounded-xl border border-indigo-200 text-indigo-700
                             text-sm font-semibold hover:bg-indigo-50 transition-colors"
                >
                  השאר פתק לבעל המשאלה
                </button>
              )}
            </div>
          )
        })}
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
