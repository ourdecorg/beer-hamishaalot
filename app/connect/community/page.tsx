/**
 * /connect/community?token=hl_...
 *
 * Server Component.  Validates the handshake token and decides which UI to render:
 *  - Invalid / expired token   → error screen
 *  - Already logged in         → "confirm link" or "already linked" screen
 *  - Not logged in             → Google / Magic-Link auth UI
 */

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeCommunityLink } from '@/lib/community-links/complete'
import ConnectCommunityClient from './ConnectCommunityClient'
import Link from 'next/link'

interface PageProps {
  searchParams: { token?: string; error?: string }
}

export default async function ConnectCommunityPage({ searchParams }: PageProps) {
  const token = searchParams?.token

  if (!token) {
    notFound()
  }

  // ── Validate pending handshake ─────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('pending_identity_links')
    .select('community_user_id, server_id, email, display_name, expires_at, status, consumed_at')
    .eq('handshake_token', token)
    .single()

  if (!pending) {
    return <ErrorScreen code="HANDSHAKE_NOT_FOUND" />
  }

  if (new Date(pending.expires_at) < new Date()) {
    return <ErrorScreen code="HANDSHAKE_EXPIRED" />
  }

  if (pending.status !== 'pending' || pending.consumed_at) {
    return <ErrorScreen code="HANDSHAKE_ALREADY_CONSUMED" />
  }

  // ── Check current session ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Already authenticated ──────────────────────────────────────────────────
  if (user) {
    const result = await completeCommunityLink(token, user, admin)

    if (result.ok) {
      // Successful immediate link — redirect to success
      // (can't redirect from Server Component after async DB work in Next 14
      //  without a client redirect; return a redirect-page instead)
      return (
        <SimplePage>
          <div className="text-center space-y-4">
            <div className="text-5xl">🔗</div>
            <h1 className="text-2xl font-bold text-slate-900">החשבונות חוברו בהצלחה!</h1>
            <p className="text-slate-600 text-sm">
              חשבון הקהילה שלך ({pending.display_name ?? pending.community_user_id}) חובר לחשבון WoW שלך.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              חזרה לדף הבית
            </Link>
          </div>
        </SimplePage>
      )
    }

    if (result.code === 'ALREADY_LINKED' || result.code === 'HANDSHAKE_ALREADY_CONSUMED') {
      return (
        <SimplePage>
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold text-slate-900">כבר מחובר</h1>
            <p className="text-slate-600 text-sm">החשבונות שלך כבר מחוברים.</p>
            <Link href="/" className="text-sm text-indigo-600 hover:underline block mt-2">
              חזרה לדף הבית
            </Link>
          </div>
        </SimplePage>
      )
    }

    if (result.code === 'EMAIL_MISMATCH') {
      return (
        <SimplePage>
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-slate-900">האימייל אינו תואם</h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              החשבונות לא קושרו כי האימייל שהתחברת איתו שונה מהאימייל שרשום בקהילה.
              אנא התחבר עם כתובת האימייל הנכונה.
            </p>
            <ConnectCommunityClient
              handshakeToken={token}
              displayName={pending.display_name ?? null}
              serverId={pending.server_id}
              authError={null}
            />
          </div>
        </SimplePage>
      )
    }

    if (result.code === 'LINK_CONFLICT') {
      return (
        <SimplePage>
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-slate-900">חשבון כבר מחובר</h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              חשבון WoW זה כבר מחובר לזהות קהילה אחרת בשרת זה.
            </p>
            <Link href="/" className="text-sm text-indigo-600 hover:underline block mt-2">
              חזרה לדף הבית
            </Link>
          </div>
        </SimplePage>
      )
    }

    // Generic error
    return <ErrorScreen code={result.code} />
  }

  // ── Not logged in — show auth UI ───────────────────────────────────────────
  return (
    <SimplePage>
      <ConnectCommunityClient
        handshakeToken={token}
        displayName={pending.display_name ?? null}
        serverId={pending.server_id}
        authError={searchParams?.error ?? null}
      />
    </SimplePage>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SimplePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span className="text-lg font-black text-indigo-600">W</span>
          <span className="font-semibold text-slate-800">באר המשאלות</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

function ErrorScreen({ code }: { code: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    HANDSHAKE_NOT_FOUND:       { title: 'קישור לא תקין',    body: 'הקישור לחיבור החשבונות אינו תקין.' },
    HANDSHAKE_EXPIRED:         { title: 'קישור פג תוקף',    body: 'הקישור לחיבור החשבונות פג תוקפו. אנא בקש קישור חדש מהקהילה.' },
    HANDSHAKE_ALREADY_CONSUMED: { title: 'קישור כבר שומש',  body: 'קישור זה כבר שומש בעבר.' },
  }

  const msg = messages[code] ?? { title: 'שגיאה', body: `קוד שגיאה: ${code}` }

  return (
    <SimplePage>
      <div className="text-center space-y-4">
        <div className="text-5xl">❌</div>
        <h1 className="text-2xl font-bold text-slate-900">{msg.title}</h1>
        <p className="text-slate-600 text-sm leading-relaxed">{msg.body}</p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline block mt-2">
          חזרה לדף הבית
        </Link>
      </div>
    </SimplePage>
  )
}
