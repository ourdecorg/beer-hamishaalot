'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    setErrorMsg('')

    // Use server-side API route so emailRedirectTo uses APP_URL runtime env var
    // (avoids window.location.origin returning Railway's internal localhost:8080)
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setStatus('error')
      setErrorMsg(data.error ?? 'אירעה שגיאה. נסה שוב.')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-sand-50">
      {/* Minimal header */}
      <div className="p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-well-700 hover:text-well-900 transition-colors"
        >
          <span>✦</span>
          <span style={{ fontFamily: 'var(--font-frank-ruhl)' }}>באר המשאלות</span>
        </Link>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Well icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-well-800 shadow-lg mb-4">
              <span className="text-2xl text-amber-300">✦</span>
            </div>
            <h1
              className="text-3xl font-bold text-well-900"
              style={{ fontFamily: 'var(--font-frank-ruhl)' }}
            >
              ברוך הבא לבאר
            </h1>
            <p className="text-well-500 mt-2">הכנס את כתובת האימייל שלך כדי להיכנס</p>
          </div>

          {/* Card */}
          <div className="card p-8">
            {status === 'sent' ? (
              <div className="text-center space-y-4">
                <div className="text-5xl">📬</div>
                <h2
                  className="text-xl font-bold text-well-900"
                  style={{ fontFamily: 'var(--font-frank-ruhl)' }}
                >
                  בדוק את האימייל שלך
                </h2>
                <p className="text-well-600 text-sm leading-relaxed">
                  שלחנו קישור כניסה לכתובת{' '}
                  <strong className="text-well-800">{email}</strong>.
                  <br />
                  לחץ על הקישור כדי להיכנס לבאר.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="btn-ghost text-sm w-full justify-center"
                >
                  שלח שוב עם אימייל אחר
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-well-700 mb-2"
                  >
                    כתובת אימייל
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="input-base text-left"
                    dir="ltr"
                    disabled={status === 'loading'}
                  />
                </div>

                {status === 'error' && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                    {errorMsg || 'אירעה שגיאה. נסה שוב.'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <span className="animate-spin text-sm">⟳</span>
                      <span>שולח...</span>
                    </>
                  ) : (
                    <>
                      <span>✦</span>
                      <span>שלח קישור כניסה</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-sand-400 text-center leading-relaxed">
                  אין סיסמאות. רק קישור קסם לאימייל שלך.
                </p>
              </form>
            )}
          </div>

          <p className="text-center mt-6 text-sm text-sand-500">
            <Link href="/" className="hover:text-well-600 transition-colors">
              חזרה לדף הבית
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
