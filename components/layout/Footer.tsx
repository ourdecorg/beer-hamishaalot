import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto py-10 border-t border-sand-200 bg-sand-50">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-sand-500">
        <div className="flex items-center gap-2">
          <span className="text-lg">✦</span>
          <span style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
            באר המשאלות
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/wishes/feed" className="hover:text-well-600 transition-colors">
            הבאר
          </Link>
          <Link href="/wishes/new" className="hover:text-well-600 transition-colors">
            שלח משאלה
          </Link>
          <Link href="/login" className="hover:text-well-600 transition-colors">
            כניסה
          </Link>
        </div>

        <p className="text-xs text-sand-400">
          כל המשאלות שמורות בלב
        </p>
      </div>
    </footer>
  )
}
