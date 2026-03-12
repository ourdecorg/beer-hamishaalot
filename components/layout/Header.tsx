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

  const handleSignOut = async () => {
    await getSupabase().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-sand-50/90 backdrop-blur-md border-b border-sand-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl select-none">✦</span>
          <span
            className="text-xl font-serif text-well-800 hidden sm:block"
            style={{ fontFamily: 'var(--font-frank-ruhl)' }}
          >
            באר המשאלות
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/wishes/feed"
            className={`btn-ghost text-sm ${
              pathname === '/wishes/feed' ? 'text-well-900 bg-sand-100' : ''
            }`}
          >
            הבאר
          </Link>

          {!loading && (
            <>
              {user ? (
                <>
                  <Link
                    href="/wishes/new"
                    className="btn-primary text-sm px-4 py-2"
                  >
                    <span>✦</span>
                    <span>משאלה חדשה</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost text-sm text-sand-500"
                  >
                    יציאה
                  </button>
                </>
              ) : (
                <Link href="/login" className="btn-primary text-sm px-4 py-2">
                  כניסה
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
