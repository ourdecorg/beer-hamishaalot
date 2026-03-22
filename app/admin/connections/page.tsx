'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────

type Wish = {
  id: string
  original_text: string
  created_at: string
  contact_name: string | null
  contact_email: string | null
  contact_city: string | null
  contact_country: string | null
}

type LogEntry = {
  id: string
  wish_id: string
  candidate_wish_id: string
  _direction: string
  semantic_similarity: number
  complementarity_score: number
  intent_compatibility: number | null
  domain_match: number | null
  structural_similarity: number | null
  recall_source: string | null
  geo_penalty: number | null
  match_score: number
  match_type: string | null
  passed_threshold: boolean
  failed_date_range: boolean
  created_at: string
}

type Connection = {
  id: string
  wish_a: string
  wish_b: string
  match_score: number
  match_type: string
  status: string
  created_at: string
}

type Enrichment = {
  wish_id: string
  themes: string[]
  intent: string | null
  needs: string[]
  skills_offered: string[]
  collaboration_type: string | null
  emotional_tone: string | null
  primary_domain: string | null
  subject_type: string | null
  subject_entities: string[]
  target_action: string | null
  object_of_need: string[]
  location_name: string | null
  location_lat: number | null
  location_lng: number | null
  date_range_start: string | null
  date_range_end: string | null
  analyzed_at: string
}

type DebugResult = {
  logs: LogEntry[]
  connection: Connection | null
  enrichment_a: Enrichment | null
  enrichment_b: Enrichment | null
  wish_a: Wish | null
  wish_b: Wish | null
}

// ── Helpers ───────────────────────────────────────────────────

function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function num(v: number | null | undefined, digits = 3) {
  if (v == null) return '—'
  return v.toFixed(digits)
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'medium' })
}

function truncate(s: string, n = 90) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const matchTypeBg: Record<string, string> = {
  strong:        'bg-amber-100 text-amber-800 border-amber-300',
  complementary: 'bg-well-100 text-well-800 border-well-300',
  similar:       'bg-sand-100 text-sand-700 border-sand-300',
  // legacy values from before v5
  RESONANT:      'bg-amber-100 text-amber-800 border-amber-300',
  COMPLEMENTARY: 'bg-well-100 text-well-800 border-well-300',
  SIMILAR:       'bg-sand-100 text-sand-700 border-sand-300',
}

// ── Subcomponents ─────────────────────────────────────────────

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function Pill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-sand-500">{label}</span>
      <span className="text-sm font-medium text-well-800">{value}</span>
    </div>
  )
}

function EnrichmentCard({ enrichment, label }: { enrichment: Enrichment | null; label: string }) {
  if (!enrichment) {
    return (
      <div className="card p-5">
        <p className="section-label mb-3">{label}</p>
        <p className="text-sand-400 text-sm">אין נתוני ניתוח</p>
      </div>
    )
  }
  const arr = (a: string[] | null | undefined) => (a?.length ? a.join(', ') : '—')
  return (
    <div className="card p-5 space-y-4">
      <p className="section-label">{label}</p>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <Pill label="תחום" value={enrichment.primary_domain ?? '—'} />
        <Pill label="כוונה" value={enrichment.intent ?? '—'} />
        <Pill label="סוג סובייקט" value={enrichment.subject_type ?? '—'} />
        <Pill label="פעולת יעד" value={enrichment.target_action ?? '—'} />
        <Pill label="שיתוף פעולה" value={enrichment.collaboration_type ?? '—'} />
        <Pill label="טון רגשי" value={enrichment.emotional_tone ?? '—'} />
      </div>

      {enrichment.themes?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-500 mb-1.5">נושאים</p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.themes.map(t => <span key={t} className="tag-badge text-xs">{t}</span>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <Pill label="צרכים" value={arr(enrichment.needs)} />
        <Pill label="יכולות" value={arr(enrichment.skills_offered)} />
        <Pill label="אובייקט נדרש" value={arr(enrichment.object_of_need)} />
        <Pill label="ישויות" value={arr(enrichment.subject_entities)} />
      </div>

      {/* Location */}
      {enrichment.location_name && (
        <div className="bg-sand-50 border border-sand-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-500 mb-1">מיקום</p>
          <p className="text-well-800 font-medium">{enrichment.location_name}</p>
          {enrichment.location_lat != null && (
            <p className="text-sand-500 text-xs" dir="ltr">
              {enrichment.location_lat.toFixed(5)}, {enrichment.location_lng?.toFixed(5)}
            </p>
          )}
        </div>
      )}

      {/* Date range */}
      {(enrichment.date_range_start || enrichment.date_range_end) && (
        <div className="bg-sand-50 border border-sand-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-500 mb-1">טווח זמן</p>
          <p className="text-well-800 font-medium" dir="ltr">
            {enrichment.date_range_start ?? '(פתוח)'} → {enrichment.date_range_end ?? '(לעד)'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function ConnectionsDebugPage() {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [wishA, setWishA] = useState('')
  const [wishB, setWishB] = useState('')
  const [filterA, setFilterA] = useState('')
  const [filterB, setFilterB] = useState('')
  const [result, setResult] = useState<DebugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [wishListLoading, setWishListLoading] = useState(true)
  const [error, setError] = useState('')

  // Load wish list on mount
  useEffect(() => {
    fetch('/api/admin/connections')
      .then(r => r.json())
      .then(d => setWishes(d.wishes ?? []))
      .catch(() => setError('שגיאה בטעינת המשאלות'))
      .finally(() => setWishListLoading(false))
  }, [])

  const fetchDebug = useCallback(async () => {
    if (!wishA || !wishB || wishA === wishB) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await fetch(`/api/admin/connections?a=${wishA}&b=${wishB}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setResult(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה')
    } finally {
      setLoading(false)
    }
  }, [wishA, wishB])

  const filteredWishes = (filter: string) =>
    wishes.filter(w =>
      filter.length < 2 ||
      w.original_text.includes(filter) ||
      w.id.startsWith(filter) ||
      (w.contact_name ?? '').includes(filter)
    ).slice(0, 120)

  const wishById = (id: string) => wishes.find(w => w.id === id)

  return (
    <div className="min-h-screen bg-sand-50 p-4 sm:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="section-label mb-1">כלי אדמין</p>
            <h1 className="text-2xl sm:text-3xl text-well-900" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
              תחקור חיבורים בין משאלות
            </h1>
          </div>
          <Link href="/admin/test-data" className="btn-ghost text-sm">
            ← כלי ניהול אחרים
          </Link>
        </div>

        {/* Wish selector */}
        <div className="card p-6 space-y-5">
          <p className="section-label">בחר זוג משאלות לבדיקה</p>

          {wishListLoading && (
            <p className="text-sand-400 text-sm">טוען משאלות…</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Wish A */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-well-700">משאלה א׳</label>
              <input
                type="text"
                placeholder="חפש לפי טקסט, שם, UUID…"
                value={filterA}
                onChange={e => setFilterA(e.target.value)}
                className="input-base text-sm"
              />
              <select
                size={6}
                value={wishA}
                onChange={e => setWishA(e.target.value)}
                className="input-base text-sm h-auto p-0 overflow-y-auto"
                style={{ height: '180px' }}
              >
                <option value="">— בחר משאלה —</option>
                {filteredWishes(filterA).map(w => (
                  <option key={w.id} value={w.id}>
                    {truncate(w.original_text)} {w.contact_name ? `(${w.contact_name})` : ''}
                  </option>
                ))}
              </select>
              {wishA && (
                <p className="text-xs text-sand-500 font-mono break-all" dir="ltr">{wishA}</p>
              )}
            </div>

            {/* Wish B */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-well-700">משאלה ב׳</label>
              <input
                type="text"
                placeholder="חפש לפי טקסט, שם, UUID…"
                value={filterB}
                onChange={e => setFilterB(e.target.value)}
                className="input-base text-sm"
              />
              <select
                size={6}
                value={wishB}
                onChange={e => setWishB(e.target.value)}
                className="input-base text-sm h-auto p-0 overflow-y-auto"
                style={{ height: '180px' }}
              >
                <option value="">— בחר משאלה —</option>
                {filteredWishes(filterB).map(w => (
                  <option key={w.id} value={w.id}>
                    {truncate(w.original_text)} {w.contact_name ? `(${w.contact_name})` : ''}
                  </option>
                ))}
              </select>
              {wishB && (
                <p className="text-xs text-sand-500 font-mono break-all" dir="ltr">{wishB}</p>
              )}
            </div>
          </div>

          <button
            onClick={fetchDebug}
            disabled={!wishA || !wishB || wishA === wishB || loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span className="animate-spin">⟳</span> : <span>🔍</span>}
            <span>תחקר חיבור</span>
          </button>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6 fade-in">

            {/* Wish texts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([['א', result.wish_a], ['ב', result.wish_b]] as const).map(([label, wish]) => (
                <div key={label} className="card p-5">
                  <p className="section-label mb-3">משאלה {label}</p>
                  {wish ? (
                    <>
                      <p className="text-well-800 leading-relaxed text-sm mb-3">{wish.original_text}</p>
                      <div className="text-xs text-sand-500 space-y-1">
                        {wish.contact_name && <p>👤 {wish.contact_name}</p>}
                        {wish.contact_city && <p>📍 {wish.contact_city}{wish.contact_country ? `, ${wish.contact_country}` : ''}</p>}
                        <p>🕐 {fmt(wish.created_at)}</p>
                        <p className="font-mono break-all" dir="ltr">{wish.id}</p>
                      </div>
                    </>
                  ) : <p className="text-sand-400 text-sm">לא נמצאה</p>}
                </div>
              ))}
            </div>

            {/* Connection status */}
            <div className={`card p-6 border-2 ${result.connection ? 'border-emerald-300 bg-emerald-50/40' : 'border-sand-300 bg-sand-50/40'}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{result.connection ? '🔗' : '⭕'}</span>
                  <div>
                    <p className="font-semibold text-well-900">
                      {result.connection ? 'חיבור קיים ב-wish_connections' : 'אין חיבור ב-wish_connections'}
                    </p>
                    <p className="text-sm text-sand-500">
                      {result.connection
                        ? `נוצר: ${fmt(result.connection.created_at)}`
                        : 'הזוג הזה לא עמד בסף הציון או לא עבר את בדיקות הסינון'}
                    </p>
                  </div>
                </div>
                {result.connection && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${matchTypeBg[result.connection.match_type] ?? 'bg-sand-100 border-sand-200 text-sand-700'}`}>
                      {result.connection.match_type}
                    </span>
                    <span className="text-2xl font-black text-well-700">
                      {pct(result.connection.match_score)}
                    </span>
                    <span className="tag-badge text-xs">{result.connection.status}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Match attempts log */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <p className="section-label">match_attempts_log ({result.logs.length} רשומות)</p>
                {result.logs.length === 0 && (
                  <span className="text-sand-400 text-sm">לא נרשמו ניסיונות בין הזוג הזה</span>
                )}
              </div>

              {result.logs.length > 0 && (
                <div className="space-y-4">
                  {result.logs.map((log, i) => (
                    <div key={log.id} className={`rounded-xl border p-4 space-y-3 ${log.passed_threshold ? 'border-emerald-200 bg-emerald-50/30' : 'border-sand-200 bg-sand-50/50'}`}>

                      {/* Row header */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge ok={log.passed_threshold} label={log.passed_threshold ? 'עבר סף' : 'לא עבר סף'} />
                          <span className="text-xs font-mono text-sand-400 bg-sand-100 px-2 py-0.5 rounded" dir="ltr">{log._direction}</span>
                          {log.match_type && (
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${matchTypeBg[log.match_type] ?? 'bg-sand-100 border-sand-200 text-sand-700'}`}>
                              {log.match_type}
                            </span>
                          )}
                          {log.recall_source && (
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                              log.recall_source === 'both'       ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : log.recall_source === 'structured' ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}>
                              {log.recall_source === 'both' ? '◈ שני מסלולים'
                                : log.recall_source === 'structured' ? '◇ מובנה'
                                : '◆ סמנטי'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-sand-400">{fmt(log.created_at)}</span>
                      </div>

                      {/* Failure reasons */}
                      {log.failed_date_range && (
                        <div className="flex gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            📅 נכשל — אין חפיפת זמן
                          </span>
                        </div>
                      )}

                      {/* Score breakdown — v8: 4 signals + geo penalty */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Pill label="ציון כולל" value={<span className="text-base font-black text-well-700">{pct(log.match_score)}</span>} />
                        <Pill label="סמנטי (×0.35)" value={pct(log.semantic_similarity)} />
                        <Pill label="משלימות (×0.30)" value={pct(log.complementarity_score)} />
                        <Pill label="כוונה (×0.15)" value={log.intent_compatibility != null ? pct(log.intent_compatibility) : '—'} />
                        <Pill label="מבנה (×0.20)" value={log.structural_similarity != null ? pct(log.structural_similarity) : '—'} />
                        <Pill
                          label="עונש מרחק"
                          value={
                            log.geo_penalty != null && log.geo_penalty < 1
                              ? <span className="text-orange-600 font-semibold">{num(log.geo_penalty, 3)}</span>
                              : <span className="text-sand-400">1.000</span>
                          }
                        />
                      </div>

                      {/* Log ID */}
                      <p className="text-[10px] font-mono text-sand-300 break-all" dir="ltr">id: {log.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enrichment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnrichmentCard enrichment={result.enrichment_a} label="ניתוח AI — משאלה א׳" />
              <EnrichmentCard enrichment={result.enrichment_b} label="ניתוח AI — משאלה ב׳" />
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
