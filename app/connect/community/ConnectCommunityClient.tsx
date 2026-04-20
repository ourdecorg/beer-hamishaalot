'use client'

/**
 * ConnectCommunityClient
 *
 * The interactive auth UI for the community account-linking flow.
 * Called from the /connect/community Server Component when:
 *  - The user is not yet authenticated, OR
 *  - The authenticated user's email doesn't match the pending handshake email.
 *
 * Offers Google OAuth and Magic-Link sign-in, both routed through Server Actions
 * that set the community_handshake httpOnly cookie before triggering auth.
 */

import { useState, useTransition } from 'react'
import { loginWithGoogleForCommunity, sendMagicLinkForCommunity } from './actions'

interface Props {
  handshakeToken: string
  displayName:    string | null
  serverId:       string
  authError:      string | null
}

export default function ConnectCommunityClient({
  handshakeToken,
  displayName,
  serverId,
  authError,
}: Props) {
  const [email,       setEmail]       = useState('')
  const [linkStatus,  setLinkStatus]  = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg,    setErrorMsg]    = useState(authError ?? '')

  const [googlePending, startGoogle]     = useTransition()
  const [magicPending,  startMagicLink]  = useTransition()

  const loading = googlePending || magicPending

  function handleGoogle() {
    startGoogle(async () => {
      await loginWithGoogleForCommunity(handshakeToken)
    })
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setErrorMsg('')
    startMagicLink(async () => {
      const result = await sendMagicLinkForCommunity(handshakeToken, email.trim())
      if (result.ok) {
        setLinkStatus('sent')
      } else {
        setErrorMsg(result.error ?? 'שגיאה בשליחת הקישור')
        setLinkStatus('error')
      }
    })
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-2">
          <span className="text-2xl">🔗</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">חיבור חשבון קהילה</h1>
        {displayName && (
          <p className="text-slate-500 text-sm">
            שלום <strong>{displayName}</strong>! התחבר כדי לקשר את חשבון הקהילה שלך.
          </p>
        )}
        {!displayName && (
          <p className="text-slate-500 text-sm">
            התחבר כדי לקשר את חשבון הקהילה שלך לחשבון WoW.
          </p>
        )}
        <p className="text-xs text-slate-400">שרת: {serverId}</p>
      </div>

      {linkStatus === 'sent' ? (
        /* ── Magic-link sent ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h2 className="text-lg font-bold text-slate-900">בדוק את תיבת הדואר שלך</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            שלחנו קישור כניסה לכתובת{' '}
            <strong className="text-slate-800 dir-ltr">{email}</strong>.
            <br />
            לחץ על הקישור בדואר כדי להשלים את חיבור החשבון.
          </p>
          <button
            onClick={() => { setLinkStatus('idle'); setEmail('') }}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            שלח שנית
          </button>
        </div>
      ) : (
        /* ── Auth options ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googlePending ? (
              <span className="animate-spin text-base">⟳</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            <span>המשך עם Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">או</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Magic link */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label
                htmlFor="community-email"
                className="block text-sm font-medium text-slate-700 mb-2 text-right"
              >
                כתובת אימייל
              </label>
              <input
                id="community-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                dir="ltr"
                disabled={loading}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-left
                           focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
              />
            </div>

            {(linkStatus === 'error' || errorMsg) && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200 text-right">
                {errorMsg || 'שגיאה בכניסה'}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600
                         hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {magicPending ? (
                <>
                  <span className="animate-spin text-sm">⟳</span>
                  <span>שולח...</span>
                </>
              ) : (
                <span>שלח קישור כניסה</span>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              נשלח לך קישור כניסה ללא סיסמה
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
