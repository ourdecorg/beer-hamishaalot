'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin/test-data',     icon: '📦', label: 'טעינת TEST DATA' },
  { href: '/admin/run-matching',  icon: '⚡', label: 'הרצת MATCHES' },
  { href: '/admin/connections',   icon: '🔍', label: 'MATCHES DEBUG' },
  { href: '/admin/settlements',   icon: '🏘', label: 'טעינת ישובים' },
  { href: '/admin/countries',     icon: '🌍', label: 'טעינת ארצות' },
  { href: '/admin/review-matches',  icon: '⭐', label: 'פידבק התאמות' },
  { href: '/admin/backfill-profiles', icon: '👤', label: 'פרופילים חסרים' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="w-44 shrink-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 mb-3">
        כלי ניהול
      </p>
      <ul className="space-y-1">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="leading-snug">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
