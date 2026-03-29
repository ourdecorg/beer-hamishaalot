'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'

export default function LoginPage() {
  const lang = useLang()
  const tr = t(lang).login
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/wishes/new'
  const hasAuthError = searchParams.get('error') === 'auth'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setStatus('error')
      setErrorMsg(data.error ?? tr.error)
    } else {
      setStatus('sent')
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.url) {
      window.location.href = data.url
    } else {
      setGoogleLoading(false)
      setErrorMsg(data.error ?? tr.error)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Minimal header */}
      <div className="p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span className="text-lg font-black text-indigo-600">W</span>
          <span className="font-semibold text-slate-800">{t(lang).siteName}</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
              <span className="text-2xl">✉️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {tr.heading}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">{tr.subtitle}</p>
          </div>

          <div className="card p-8">
            {status === 'sent' ? (
              <div className="text-center space-y-4">
                <div className="text-5xl">📬</div>
                <h2 className="text-xl font-bold text-slate-900">
                  {tr.sentTitle}
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {tr.sentDesc}{' '}
                  <strong className="text-slate-800">{email}</strong>.
                  <br />
                  {tr.sentInstructions}
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="btn-ghost text-sm w-full justify-center"
                >
                  {tr.resend}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Google button */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <span className="animate-spin text-base">⟳</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span>{tr.googleBtn}</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{tr.orDivider}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Email form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      {tr.emailLabel}
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

                  {(status === 'error' || hasAuthError) && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                      {errorMsg || tr.error}
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
                        <span>{tr.submitting}</span>
                      </>
                    ) : (
                      <span>{tr.submitBtn}</span>
                    )}
                  </button>

                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    {tr.noPassword}
                  </p>
                </form>
              </div>
            )}
          </div>

          <p className="text-center mt-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800 transition-colors">
              {tr.backHome}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
