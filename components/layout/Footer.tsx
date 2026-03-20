import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-sand-200 bg-white/60 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">

          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl text-well-700">✦</span>
              <span
                className="text-xl text-well-800"
                style={{ fontFamily: 'var(--font-frank-ruhl)' }}
              >
                באר המשאלות
              </span>
            </div>
            <p className="text-xs text-sand-500 max-w-[200px] leading-relaxed">
              פלטפורמה לחיבור בין אנשים על בסיס משאלות ושאיפות משותפות
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-sand-500">
            <Link href="/wishes/new" className="hover:text-well-700 transition-colors">
              שלח משאלה
            </Link>
            <Link href="/wishes/my" className="hover:text-well-700 transition-colors">
              המשאלות שלי
            </Link>
            <Link href="/login" className="hover:text-well-700 transition-colors">
              כניסה
            </Link>
          </nav>

          {/* Caption */}
          <p className="text-xs text-sand-400 italic" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
            כל המשאלות שמורות בלב ✦
          </p>
        </div>
      </div>
    </footer>
  )
}
