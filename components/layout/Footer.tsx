import Link from 'next/link'
import { getLang } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'

export default async function Footer() {
  const lang = await getLang()
  const tr = t(lang)

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

          {/* Brand */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-indigo-600">W</span>
              <span className="text-base font-bold text-slate-800">{tr.siteName}</span>
            </div>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              {tr.tagline}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <nav className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/wishes/new" className="hover:text-slate-800 transition-colors">
                {tr.nav.newWish}
              </Link>
              <Link href="/wishes/my" className="hover:text-slate-800 transition-colors">
                {tr.nav.myWishes}
              </Link>
              <Link href="/login" className="hover:text-slate-800 transition-colors">
                {tr.nav.login}
              </Link>
            </nav>
            <nav className="flex items-center gap-6 text-xs text-slate-400">
              <Link href="/privacy" className="hover:text-slate-600 transition-colors">
                {tr.footer.privacy}
              </Link>
              <Link href="/terms" className="hover:text-slate-600 transition-colors">
                {tr.footer.terms}
              </Link>
            </nav>
          </div>

        </div>
      </div>
    </footer>
  )
}
