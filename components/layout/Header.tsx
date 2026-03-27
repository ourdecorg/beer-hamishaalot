'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // Lazy ref so the client is never instantiated during SSR
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    const supabase = getSupabase()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close menu when navigating
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Close menu on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSignOut = async () => {
    await getSupabase().auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isAdmin = !!(user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL)

  const activeCls = (path: string) =>
    pathname === path ? 'font-semibold text-well-900 bg-sand-50' : 'text-well-700'

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-sand-200/60 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl select-none text-well-800">✦</span>
          <span
            className="text-xl font-serif text-well-800 hidden sm:block"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            באר המשאלות
          </span>
          {process.env.NEXT_PUBLIC_ENV === 'dev' && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 select-none">
              dev
            </span>
          )}
        </Link>

        {/* ── Desktop nav (sm+) ─────────────────────────────── */}
        {!loading && (
          <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <Link
                  href="/matches"
                  className={`btn-ghost text-sm ${pathname === '/matches' ? 'text-well-900 bg-well-50 font-semibold' : ''}`}
                >
                  ההתאמות שלי
                </Link>
                <Link
                  href="/wishes/my"
                  className={`btn-ghost text-sm ${pathname === '/wishes/my' ? 'text-well-900 bg-well-50 font-semibold' : ''}`}
                >
                  המשאלות שלי
                </Link>
                <Link href="/wishes/new" className="btn-primary text-sm px-4 py-2 shadow-md">
                  <span>✦</span>
                  <span>משאלה חדשה</span>
                </Link>
                <span className="text-xs text-sand-400 max-w-[120px] truncate" dir="ltr">
                  {user.email}
                </span>
                <button onClick={handleSignOut} className="btn-ghost text-xs text-sand-500">
                  יציאה
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2">כניסה</Link>
            )}
          </nav>
        )}

        {/* ── Mobile nav (< sm) ─────────────────────────────── */}
        {!loading && (
          <div className="flex sm:hidden items-center gap-2">
            {user ? (
              <div className="relative" ref={menuRef}>
                {/* Hamburger toggle */}
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="btn-ghost px-3 py-2 text-xl text-well-700 leading-none"
                  aria-label="תפריט ניווט"
                >
                  {menuOpen ? '✕' : '☰'}
                </button>

                {/* Dropdown panel */}
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-60 bg-white rounded-2xl border border-sand-200 shadow-xl z-50 overflow-hidden">

                    {/* Primary action */}
                    <div className="p-2">
                      <Link
                        href="/wishes/new"
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-well-700 text-white text-sm font-medium hover:bg-well-600 transition-colors"
                      >
                        <span>✦</span>
                        <span>משאלה חדשה</span>
                      </Link>
                    </div>

                    <div className="border-t border-sand-100" />

                    {/* Main nav */}
                    <div className="p-2 space-y-0.5">
                      <Link
                        href="/wishes/my"
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors ${activeCls('/wishes/my')}`}
                      >
                        המשאלות שלי
                      </Link>
                      <Link
                        href="/matches"
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors ${activeCls('/matches')}`}
                      >
                        ההתאמות שלי
                      </Link>
                    </div>

                    {/* Admin section */}
                    {isAdmin && (
                      <>
                        <div className="border-t border-sand-100" />
                        <div className="p-2 space-y-0.5">
                          <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sand-400">
                            ניהול
                          </p>
                          <Link
                            href="/admin/test-data"
                            className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors ${activeCls('/admin/test-data')}`}
                          >
                            טעינה והרצת התאמות
                          </Link>
                          <Link
                            href="/admin/connections"
                            className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors ${activeCls('/admin/connections')}`}
                          >
                            ניפוי חיבורים
                          </Link>
                        </div>
                      </>
                    )}

                    <div className="border-t border-sand-100" />

                    {/* User + sign out */}
                    <div className="p-2">
                      <p className="px-4 py-1 text-xs text-sand-400 truncate" dir="ltr">
                        {user.email}
                      </p>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-right px-4 py-2.5 rounded-xl text-sm text-sand-500 hover:bg-sand-50 transition-colors"
                      >
                        יציאה
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2">כניסה</Link>
            )}
          </div>
        )}

      </div>
    </header>
  )
}
