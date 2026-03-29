'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const lang = useLang()
  const tr = t(lang)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => { setMenuOpen(false) }, [pathname])

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
    pathname === path ? 'font-semibold text-slate-900 bg-slate-100' : 'text-slate-700'

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <span className="text-lg font-black text-indigo-600 select-none shrink-0">W</span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold text-slate-800">
              {tr.siteName}
            </span>
            <span className="hidden sm:block text-[11px] text-slate-400 font-normal">
              {tr.tagline}
            </span>
          </div>
          {process.env.NEXT_PUBLIC_ENV === 'dev' && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 select-none shrink-0">
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
                  className={`btn-ghost text-sm ${pathname === '/matches' ? 'text-slate-900 bg-slate-100 font-semibold' : ''}`}
                >
                  {tr.nav.myMatches}
                </Link>
                <Link
                  href="/wishes/my"
                  className={`btn-ghost text-sm ${pathname === '/wishes/my' ? 'text-slate-900 bg-slate-100 font-semibold' : ''}`}
                >
                  {tr.nav.myWishes}
                </Link>
                <Link href="/wishes/new" className="btn-primary text-sm px-4 py-2">
                  <span>{tr.nav.newWish}</span>
                </Link>
                <span className="text-xs text-slate-400 max-w-[120px] truncate" dir="ltr">
                  {user.email}
                </span>
                <button onClick={handleSignOut} className="btn-ghost text-xs text-slate-500">
                  {tr.nav.logout}
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2">{tr.nav.login}</Link>
            )}
            <LanguageSwitcher />
          </nav>
        )}

        {/* ── Mobile nav (< sm) ─────────────────────────────── */}
        {!loading && (
          <div className="flex sm:hidden items-center gap-2">
            <LanguageSwitcher />
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="btn-ghost px-3 py-2 text-xl text-slate-700 leading-none"
                  aria-label={tr.nav.menuAriaLabel}
                >
                  {menuOpen ? '✕' : '☰'}
                </button>

                {menuOpen && (
                  <div className="absolute end-0 top-full mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">

                    <div className="p-2">
                      <Link
                        href="/wishes/new"
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                      >
                        <span>{tr.nav.newWish}</span>
                      </Link>
                    </div>

                    <div className="border-t border-slate-100" />

                    <div className="p-2 space-y-0.5">
                      <Link
                        href="/wishes/my"
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors ${activeCls('/wishes/my')}`}
                      >
                        {tr.nav.myWishes}
                      </Link>
                      <Link
                        href="/matches"
                        className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors ${activeCls('/matches')}`}
                      >
                        {tr.nav.myMatches}
                      </Link>
                    </div>

                    {isAdmin && (
                      <>
                        <div className="border-t border-slate-100" />
                        <div className="p-2 space-y-0.5">
                          <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                            {tr.nav.admin}
                          </p>
                          <Link
                            href="/admin/test-data"
                            className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors ${activeCls('/admin/test-data')}`}
                          >
                            {tr.nav.adminTestData}
                          </Link>
                          <Link
                            href="/admin/connections"
                            className={`flex items-center px-4 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors ${activeCls('/admin/connections')}`}
                          >
                            {tr.nav.adminConnections}
                          </Link>
                        </div>
                      </>
                    )}

                    <div className="border-t border-slate-100" />

                    <div className="p-2">
                      <p className="px-4 py-1 text-xs text-slate-400 truncate" dir="ltr">
                        {user.email}
                      </p>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-start px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        {tr.nav.logout}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2">{tr.nav.login}</Link>
            )}
          </div>
        )}

      </div>
    </header>
  )
}
