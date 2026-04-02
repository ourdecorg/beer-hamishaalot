'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttemptRow {
  id: string
  wish_id: string
  candidate_wish_id: string
  semantic_similarity: number
  complementarity_score: number
  structural_similarity: number | null
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

export interface WishEnrichmentStub {
  wish_id: string
  needs: string[] | null
  skills_offered: string[] | null
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
  enrichmentMap: Record<string, WishEnrichmentStub>
  connectionMap: Record<string, string | null>
  reviewMap: Record<string, ExistingReview>
  userEmail: string
  filters: { type: string; reviewed: string; gate: string; near: string; cancelled: string }
  sort: string
  search: string
  page: number
  totalPages: number
  totalCount: number
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
  good:  { label: 'טוב',    active: 'bg-emerald-600 text-white border-emerald-600', idle: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
  maybe: { label: 'אולי',   active: 'bg-amber-500 text-white border-amber-500',     idle: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
  bad:   { label: 'לא טוב', active: 'bg-red-500 text-white border-red-500',         idle: 'border-red-300 text-red-600 hover:bg-red-50' },
}

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'match_score',     label: 'ציון סופי' },
  { key: 'semantic_en',     label: 'סמנטי' },
  { key: 'complementarity', label: 'משלים (obs.)' },
  { key: 'structural',      label: 'מבני (obs.)' },
  { key: 'geo',             label: 'גיאו' },
]

// ── Shared URL builder ────────────────────────────────────────────────────────

function buildUrl(
  pathname: string,
  filters: ReviewMatchesProps['filters'],
  sort: string,
  search: string,
  page: number,
  overrides: Record<string, string> = {}
) {
  const params = new URLSearchParams({
    type: filters.type, reviewed: filters.reviewed, gate: filters.gate,
    near: filters.near, cancelled: filters.cancelled,
    sort, page: String(page),
    ...overrides,
  })
  if (search) params.set('search', search)
  return `${pathname}?${params}`
}

// ── Filter + Sort bar ─────────────────────────────────────────────────────────

function FilterBar({
  filters,
  sort,
  search,
}: {
  filters: ReviewMatchesProps['filters']
  sort: string
  search: string
}) {
  const pathname = usePathname()

  function filterLink(key: string, value: string, label: string, active: boolean) {
    return (
      <Link
        key={value}
        href={buildUrl(pathname, filters, sort, search, 1, { [key]: value })}
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
          active
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
        <span className="font-semibold text-slate-700">סוג:</span>
        {filterLink('type', 'all',      'הכל',         filters.type === 'all')}
        {filterLink('type', 'passed',   'עברו סף',      filters.type === 'passed')}
        {filterLink('type', 'rejected', 'לא עברו סף',  filters.type === 'rejected')}

        <span className="font-semibold text-slate-700 mr-1">סקירה:</span>
        {filterLink('reviewed', 'all', 'הכל',       filters.reviewed === 'all')}
        {filterLink('reviewed', 'no',  'לא סוקרו',   filters.reviewed === 'no')}
        {filterLink('reviewed', 'yes', 'סוקרו',      filters.reviewed === 'yes')}

        <span className="font-semibold text-slate-700 mr-1">שער:</span>
        {filterLink('gate', 'all',    'הכל',          filters.gate === 'all')}
        {filterLink('gate', 'failed', 'נפסלו בשער',   filters.gate === 'failed')}

        {filterLink('near', filters.near === '1' ? '0' : '1',
          filters.near === '1' ? '× קרוב לסף' : 'קרוב לסף', filters.near === '1')}

        {filterLink('cancelled', filters.cancelled === 'show' ? 'hide' : 'show',
          filters.cancelled === 'show' ? '× כולל מבוטלות' : 'כולל מבוטלות', filters.cancelled === 'show')}
      </div>

      {/* Sort */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
        <span className="font-semibold text-slate-700">מיון:</span>
        {SORT_OPTIONS.map(opt => (
          <Link
            key={opt.key}
            href={buildUrl(pathname, filters, opt.key, search, 1)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              sort === opt.key
                ? 'bg-slate-800 text-white border-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  totalCount,
  filters,
  sort,
  search,
}: {
  page: number
  totalPages: number
  totalCount: number
  filters: ReviewMatchesProps['filters']
  sort: string
  search: string
}) {
  const pathname = usePathname()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <span className="text-xs text-slate-400">
        עמוד {page} מתוך {totalPages} · {totalCount.toLocaleString()} רשומות
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildUrl(pathname, filters, sort, search, page - 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ← הקודם
          </Link>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">← הקודם</span>
        )}
        {page < totalPages ? (
          <Link
            href={buildUrl(pathname, filters, sort, search, page + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            הבא →
          </Link>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">הבא →</span>
        )}
      </div>
    </div>
  )
}

// ── Single review card ────────────────────────────────────────────────────────

function ScoreBadge({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
      highlight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600'
    }`}>
      {label}: {value}
    </span>
  )
}

function ReviewCard({
  attempt,
  wishA,
  wishB,
  enrichA,
  enrichB,
  connectionId,
  existingReview,
  userEmail,
  activeSort,
}: {
  attempt: AttemptRow
  wishA: WishStub | undefined
  wishB: WishStub | undefined
  enrichA: WishEnrichmentStub | undefined
  enrichB: WishEnrichmentStub | undefined
  connectionId: string | null
  existingReview: ExistingReview | undefined
  userEmail: string
  activeSort: string
}) {
  const [label, setLabel]   = useState<Label | null>((existingReview?.label as Label) ?? null)
  const [note, setNote]     = useState(existingReview?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(!!existingReview)

  const hasConnection = connectionId != null
  const gateBlocked   = attempt.gate_passed === false

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

  // Score components in display order with active sort highlighted
  const signals: { key: string; label: string; value: string }[] = [
    { key: 'match_score',     label: 'ציון',       value: pct(attempt.match_score) },
    { key: 'semantic_en',     label: 'סמנטי',        value: pct(attempt.semantic_similarity) },
    { key: 'complementarity', label: 'משלים (obs.)', value: pct(attempt.complementarity_score) },
    { key: 'structural',      label: 'מבני (obs.)', value: pct(attempt.structural_similarity) },
    { key: 'geo',             label: 'גיאו',        value: pct(attempt.geo_penalty) },
  ]

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${saved ? 'border-slate-200' : 'border-slate-300'}`}>

      {/* Top row */}
      <div className="flex items-center gap-2 flex-wrap">
        {gateBlocked ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            attempt.gate_reason === 'date_range_mismatch'
              ? 'bg-purple-50 border-purple-200 text-purple-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {attempt.gate_reason === 'date_range_mismatch' ? '📅 אין חפיפת זמן' : 'נפסל בשער'}
          </span>
        ) : hasConnection ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            ✓ נוצר חיבור
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
            לא נוצר חיבור
          </span>
        )}
        {attempt.match_type && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
            {attempt.match_type}
          </span>
        )}
        {attempt.recall_source && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {attempt.recall_source}
          </span>
        )}
        {saved && (
          <span className="text-xs text-emerald-600 font-medium mr-auto">✓ נשמר</span>
        )}
        {attempt.gate_passed === false && attempt.gate_reason && (
          <span className="text-xs text-red-500 font-mono mr-auto">{attempt.gate_reason}</span>
        )}
      </div>

      {/* Wish texts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">משאלה מקורית</p>
          <p className="text-sm text-slate-800 leading-relaxed">{wishA ? truncate(wishA.original_text) : attempt.wish_id}</p>
          {wishA?.contact_city && <p className="text-xs text-slate-400">{wishA.contact_city}</p>}
        </div>
        <div className="bg-indigo-50/30 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">משאלה מועמדת</p>
          <p className="text-sm text-slate-800 leading-relaxed">{wishB ? truncate(wishB.original_text) : attempt.candidate_wish_id}</p>
          {wishB?.contact_city && <p className="text-xs text-slate-400">{wishB.contact_city}</p>}
        </div>
      </div>

      {/* Complementarity raw data */}
      {(enrichA || enrichB) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'צריך', keyA: enrichA?.needs,         keyB: enrichB?.needs },
            { label: 'מציע', keyA: enrichA?.skills_offered, keyB: enrichB?.skills_offered },
          ].map(({ label, keyA, keyB }) => (
            <div key={label} className="col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label} (א׳)</p>
                <div className="flex flex-wrap gap-1">
                  {(keyA ?? []).map(t => (
                    <span key={t} className={`px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ${
                      (keyB ?? []).some(b => b.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(b.toLowerCase()))
                        ? 'ring-1 ring-indigo-400 bg-indigo-50 text-indigo-700'
                        : ''
                    }`}>{t}</span>
                  ))}
                  {(!keyA || keyA.length === 0) && <span className="text-slate-300 italic">—</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label} (ב׳)</p>
                <div className="flex flex-wrap gap-1">
                  {(keyB ?? []).map(t => (
                    <span key={t} className={`px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ${
                      (keyA ?? []).some(a => a.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(a.toLowerCase()))
                        ? 'ring-1 ring-indigo-400 bg-indigo-50 text-indigo-700'
                        : ''
                    }`}>{t}</span>
                  ))}
                  {(!keyB || keyB.length === 0) && <span className="text-slate-300 italic">—</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score signals */}
      <div className="flex flex-wrap gap-1.5">
        {signals.map(s => (
          <ScoreBadge key={s.key} label={s.label} value={s.value} highlight={s.key === activeSort} />
        ))}
      </div>

      {/* Review section */}
      <div className="flex flex-wrap items-start gap-3 pt-1 border-t border-slate-100">
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
          className="flex-1 text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 resize-none text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          dir="rtl"
        />
        <button
          onClick={handleSave}
          disabled={!label || saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {saving ? '…' : saved ? 'עדכן' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export default function ReviewMatchesClient({
  attempts, wishMap, enrichmentMap, connectionMap, reviewMap, userEmail, filters, sort, search, page, totalPages, totalCount,
}: ReviewMatchesProps) {

  const pathname = usePathname()
  const router   = useRouter()
  const [searchInput, setSearchInput] = useState(search)

  const reviewed   = attempts.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  const unreviewed = attempts.filter(a => !reviewMap[`${a.wish_id}:${a.candidate_wish_id}`])
  const good  = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'good').length
  const maybe = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'maybe').length
  const bad   = reviewed.filter(a => reviewMap[`${a.wish_id}:${a.candidate_wish_id}`]?.label === 'bad').length

  function submitSearch(value: string) {
    router.push(buildUrl(pathname, filters, sort, value.trim(), 1))
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">פידבק על איכות ההתאמות</h1>
        <p className="text-sm text-slate-500 mt-1">סקירה ידנית של התאמות לצורך כיוונון המערכת</p>
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            ['סה"כ', totalCount,        'text-slate-700'],
            ['בעמוד זה', attempts.length, 'text-slate-500'],
            ['לא סוקרו', unreviewed.length, 'text-slate-400'],
            ['סוקרו',    reviewed.length,   'text-slate-600'],
            ['טוב',      good,              'text-emerald-600'],
            ['אולי',     maybe,             'text-amber-600'],
            ['לא טוב',   bad,               'text-red-600'],
          ].map(([label, val, cls]) => (
            <span key={String(label)} className={`text-xs font-semibold ${cls}`}>
              {label}: {val}
            </span>
          ))}
        </div>
      </div>

      {/* Filters + Sort */}
      <FilterBar filters={filters} sort={sort} search={search} />

      {/* Search */}
      <form
        onSubmit={e => { e.preventDefault(); submitSearch(searchInput) }}
        className="relative"
      >
        <input
          type="search"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="חיפוש לפי טקסט משאלה (Enter לחיפוש)…"
          dir="rtl"
          className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); submitSearch('') }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        )}
      </form>

      {/* Cards */}
      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          {search ? `אין תוצאות לחיפוש "${search}"` : 'אין רשומות התואמות את הסינון הנוכחי'}
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map(attempt => {
            const connKey = canonicalKey(attempt.wish_id, attempt.candidate_wish_id)
            return (
              <ReviewCard
                key={attempt.id}
                attempt={attempt}
                wishA={wishMap[attempt.wish_id]}
                wishB={wishMap[attempt.candidate_wish_id]}
                enrichA={enrichmentMap[attempt.wish_id]}
                enrichB={enrichmentMap[attempt.candidate_wish_id]}
                connectionId={connectionMap[connKey] ?? null}
                existingReview={reviewMap[`${attempt.wish_id}:${attempt.candidate_wish_id}`]}
                userEmail={userEmail}
                activeSort={sort}
              />
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        filters={filters}
        sort={sort}
        search={search}
      />

    </div>
  )
}
