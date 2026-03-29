import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

          {/* Brand */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-indigo-600">W</span>
              <span className="text-base font-bold text-slate-800">באר המשאלות</span>
            </div>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              פלטפורמה לחיבור בין אנשים על בסיס משאלות
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/wishes/new" className="hover:text-slate-800 transition-colors">
              שלח משאלה
            </Link>
            <Link href="/wishes/my" className="hover:text-slate-800 transition-colors">
              המשאלות שלי
            </Link>
            <Link href="/login" className="hover:text-slate-800 transition-colors">
              כניסה
            </Link>
          </nav>

        </div>
      </div>
    </footer>
  )
}
