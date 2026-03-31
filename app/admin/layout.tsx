import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 h-12 flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          ← חזרה לאתר
        </Link>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          ניהול
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8 items-start">
        <AdminNav />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
