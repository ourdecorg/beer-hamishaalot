'use client'

import { useState } from 'react'

export default function BackfillProfilesPage() {
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setLoading(true)
    setError(null)
    setCreated(null)

    try {
      const res = await fetch('/api/admin/backfill-profiles', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה')
      setCreated(data.created)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">יצירת פרופילים חסרים</h1>
        <p className="text-sm text-slate-500 mt-1">
          יוצר רשומת פרופיל לכל משתמש שאין לו עדיין שורה ב-user_profiles,
          עם השם והאימייל מטבלת auth.users.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <button
          onClick={handleRun}
          disabled={loading}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'מעבד...' : 'צור פרופילים חסרים'}
        </button>

        {created !== null && (
          <p className="text-sm text-emerald-700 font-medium">
            {created === 0 ? 'אין פרופילים חסרים — הכל תקין.' : `✓ נוצרו ${created} רשומות פרופיל.`}
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
