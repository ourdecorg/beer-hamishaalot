'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttemptRow {
  id: string
  wish_id: string
  candidate_wish_id: string
  semantic_similarity: number
  complementarity_score: number
  structural_similarity: number | null
  intent_compatibility: number | null
  geo_penalty: number | null
  match_score: number
  match_type: string | null
  passed_threshold: boolean
  gate_passed: boolean | null
  gate_reason: string | null
  recall_source: string | null
  created_at: string
}

export interface WishStub {
  id: string
  original_text: string
  contact_city: string | null
  status?: string | null
}

export interface ExistingReview {
  wish_id: string
  candidate_wish_id: string
  connection_id: string | null
  label: 'good' | 'maybe' | 'bad'
  note: string | null
}

export interface ReviewMatchesProps {
  attempts: AttemptRow[]
  wishMap: Record<string, WishStub>
  connectionMap: Record<string, string | null>  // canonical "a:b" → connection_id or null
  reviewMap: Record<string, ExistingReview>     // "wish_id:candidate_wish_id" → review
  userEmail: string
  filters: { type: string; reviewed: string; gate: string; near: string; cancelled: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Label = 'good' | 'maybe' | 'bad'

function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Math.round(n * 100)}%`
}

function canonicalKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function truncate(s: string, n = 200) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const labelConfig: Record<Label, { label: string; active: string; idle: string }> = {
  good:  { label: 'טוב',     active: 'bg-emerald-600 text-white border-emerald-600', idle: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
  maybe: { label: 'אולי',    active: 'bg-amber-500 text-white border-amber-500',     idle: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
  bad:   { label: 'לא טוב',  active: 'bg-red-500 text-white border-red-500',         idle: 'border-red-300 text-red-600 hover:bg-red-50' },
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

function FilterBar({ filters }: { filters: ReviewMatchesProps['filters'] }) {
  const pathname = usePathname()

  function filterLink(key: string, value: string, label: string, active: boolean) {
    const params = new URLSearchParams({
      type: filters.type, reviewed: filters.reviewed, gate: filters.gate, near: filters.near, cancelled: filters.cancelled,
      [key]: value,
    })
    return (
      <Link
        key={value}
        href={`${pathname}?${params}`}
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
          active ? 'bg-well-800 text-white border-well-800' : 'border-sand-200 text-well-600 hover:bg-sand-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 items-center text-xs text-well-500">
      <span className="font-semibold">סוג:</span>
      {filterLink('type', 'all',      'הכל',          filters.type === 'all')}
      {filterLink('type', 'passed',   'עברו סף',       filters.type === 'passed')}
      {filterLink('type', 'rejected', 'לא עברו סף',   filters.type === 'rejected')}

      <span className="font-semibold mr-2">סקירה:</span>
      {filterLink('reviewed', 'all', 'הכל',        filters.reviewed === 'all')}
      {filterLink('reviewed', 'no',  'לא סוקרו',    filters.reviewed === 'no')}
      {filterLink('reviewed', 'yes', 'סוקרו',       filters.reviewed === 'yes')}

      <span className="font-semibold mr-2">שער:</span>
      {filterLink('gate', 'all',    'הכל',           filters.gate === 'all')}
      {filterLink('gate', 'failed', 'נפסלו בשער',    filters.gate === 'failed')}

      {filterLink('near', filters.near === '1' ? '0' : '1',
        filters.near === '1' ? '× קרוב לסף' : 'קרוב לסף', filters.near === '1')}

      {filterLink('cancelled', filters.cancelled === 'show' ? 'hide' : 'show',
        filters.cancelled === 'show' ? '× כולל מבוטלות' : 'כולל מבוטלות', filters.cancelled === 'show')}
    </div>
  )
}

// ── Single review card ─────────────────────────────────────────────────────────

function ReviewCard({
  attempt,
  wishA,
  wishB,
  connectionId,
  existingReview,
  userEmail,
}: {
  attempt: AttemptRow
  wishA: WishStub | undefined
  wishB: WishStub | undefined
  connectionId: string | null
  existingReview: ExistingReview | undefined
  userEmail: string
}) {
  const [label, setLabel] = useState<Label | null>((existingReview?.label as Label) ?? null)
  const [note, setNote]   = useState(existingReview?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(!!existingReview)

  const hasConnection  = connectionId != null
  const gateBlocked    = attempt.gate_passed === false

  async function handleSave() {
    if (!label) return
    setSaving(true)
    const res = await fetch('/api/admin/review-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wish_id: attempt.wish_id,
        candidate_wish_id: attempt.candidate_wish_id,
        connection_id: connectionId,
        label,
        note,
      }),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${saved ? 'border-sand-200' : 'border-sand-300'}`}>

      {/* Top row */}
      <div className="flex items-center gap-2 flex-wrap">
        {gateBlocked ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
            נפסל בשער
          </span>
        ) : hasConnection ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            ✓ נוצר חיבור
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sand-100 border border-sand-200 text-sand-600">
            לא נוצר חיבור
          </span>
        )}
        {attempt.match_type && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-well-50 border border-well-200 text-well-700">
            {attempt.match_type}
          </span>
        )}
        <span className="text-xs font-bold text-well-800 ml-1">
          {pct(attempt.match_score)}
        </span>
        {saved && (
          <span className="text-xs text-emerald-600 font-medium mr-auto">✓ נשמר</span>
        )}
      </div>

      {/* Wish texts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-sand-50 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sand-400">משאלה מקורית</p>
          <p className="text-sm text-well-800 leading-relaxed">{wishA ? truncate(wishA.original_text) : attempt.wish_id}</p>
          {wishA?.contact_city && <p className="text-xs text-sand-400">{wishA.contact_city}</p>}
        </div>
        <div className="bg-well-50/40 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sand-400">משאלה מועמדת</p>
          <p className="text-sm text-well-800 leading-relaxed">{wishB ? truncate(wishB.original_text) : attempt.candidate_wish_id}</p>
          {wishB?.contact_city && <p className="text-xs text-sand-400">{wishB.contact_city}</p>}
        </div>
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ['סמנטי',       pct(attempt.semantic_similarity)],
          ['משלים',       pct(attempt.complementarity_score)],
          ['מבני',        pct(attempt.structural_similarity)],
          ['כוונה',       pct(attempt.intent_compatibility)],
          ['גיאו',        pct(attempt.geo_penalty)],
          ['מקור',        attempt.recall_source ?? '—'],
          ['שער',         attempt.gate_passed == null ? '—' : attempt.gate_passed ? '✓' : `✗ ${attempt.gate_reason ?? ''}`],
        ].map(([k, v]) => (
          <span key={k} className="px-2 py-0.5 rounded bg-sand-100 text-well-600 font-mono">
            {k}: {v}
          </span>
        ))}
      </div>

      {/* Review section */}
      <div className="flex flex-wrap items-start gap-3 pt-1 border-t border-sand-100">
        <div className="flex gap-1.5">
          {(Object.keys(labelConfig) as Label[]).map(l => (
            <button
              key={l}
              onClick={() => { setLabel(l); setSaved(false) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                label === l ? labelConfig[l].active : labelConfig[l].idle
              }`}
            >
              {labelConfig[l].label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={e => { setNote(e.target.value); setSaved(false) }}
          placeholder="הערה (לא חובה)"
          rows={1}
          className="flex-1 text-xs rounded-lg border border-sand-200 px-2.5 py-1.5 resize-none text-well-700 placeholder-sand-300 focus:outline-none focus:ring-1 focus:ring-well-400"
          dir="rtl"
        />
        <button
          onClick={handleSave}
          disabled={!label || saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-well-800 text-white hover:bg-well-700 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {saving ? '…' : saved ? 'עדכן' : 'שמור פידבק'}
        </button>
      </div>
    </div>
  )
}

// ── Main client component ──────────────────────────────────────────────────────

export default function ReviewMatchesClient({
  attempts, wishMap, connectionMap, reviewMap, userEmail, filters,
}: ReviewMatchesProps) {

  const reviewed   = attempts.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  const unreviewed = attempts.filter(a => !reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  const good  = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'good').length
  const maybe = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'maybe').length
  const bad   = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'bad').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-well-900" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
          פידבק על איכות ההתאמות
        </h1>
        <p className="text-sm text-well-500 mt-1">
          סקירה ידנית של התאמות ואי-התאמות לצורך כיוונון המערכת
        </p>
        {/* Counters */}
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            ['סה״כ בבאצ׳',  attempts.length,  'text-well-700'],
            ['לא סוקרו',    unreviewed.length, 'text-sand-500'],
            ['סוקרו',       reviewed.length,   'text-well-600'],
            ['טוב',         good,              'text-emerald-600'],
            ['אולי',        maybe,             'text-amber-600'],
            ['לא טוב',      bad,               'text-red-600'],
          ].map(([label, val, cls]) => (
            <span key={String(label)} className={`text-xs font-semibold ${cls}`}>
              {label}: {val}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} />

      {/* Cards */}
      {attempts.length === 0 ? (
        <div className="card-featured p-10 text-center text-well-500 text-sm">
          אין רשומות התואמות את הסינון הנוכחי
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map(attempt => {
            const connKey = canonicalKey(attempt.wish_id, attempt.candidate_wish_id)
            const connectionId = connectionMap[connKey] ?? null
            const existingReview = reviewMap[`${attempt.wish_id}:${attempt.candidate_wish_id}`]
            return (
              <ReviewCard
                key={attempt.id}
                attempt={attempt}
                wishA={wishMap[attempt.wish_id]}
                wishB={wishMap[attempt.candidate_wish_id]}
                connectionId={connectionId}
                existingReview={existingReview}
                userEmail={userEmail}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
