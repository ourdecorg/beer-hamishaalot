/**
 * /connect/community/success
 *
 * Landing page after the OAuth / magic-link callback completes the community link.
 * The actual link creation happens in app/auth/callback/route.ts; by the time
 * the user reaches this page the link is already recorded.
 */

import Link from 'next/link'

export default function ConnectCommunitySuccessPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white" dir="rtl">
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
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-slate-900">החשבונות חוברו בהצלחה!</h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            חשבון הקהילה שלך חובר לחשבון WoW. תוכל לחזור לקהילה ולהנות מהשירות.
          </p>
          <Link
            href="/"
            className="inline-block mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500
                       text-white text-sm font-semibold rounded-lg transition-colors"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  )
}
