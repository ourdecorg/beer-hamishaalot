'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
  domain_match: number | null
  structural_similarity: number | null
  recall_source: string | null
  geo_penalty: number | null
  match_score: number
  match_type: string | null
  passed_threshold: boolean
  gate_passed: boolean | null
  gate_reason: string | null
  connection_rank: number | null
  created_at: string
}

type Connection = {
  id: string
  wish_a: string
  wish_b: string
  match_score: number
  match_type: string
  status: string
  published: boolean | null
  created_at: string
}

type Enrichment = {
  wish_id: string
  themes: string[]
  intent: string | null
  needs: string[]
  skills_offered: string[]
  collaboration_type: string | null
  primary_domain: string | null
  subject_entities: string[]
  domain_entities: string[]
  location_name: string | null
  location_lat: number | null
  location_lng: number | null
  date_range_start: string | null
  date_range_end: string | null
  analyzed_at: string
}

type BilingualText = { he: string; en: string }

type ConnectionEnrichment = {
  wish_a_id: string
  wish_b_id: string
  resonance_score: number
  collaboration_depth_score: number
  overall_connection_score: number
  confidence: number
  relationship_type: string
  why: BilingualText | null
  opportunity_for_wish_a: BilingualText | null
  opportunity_for_wish_b: BilingualText | null
  shared_basis: BilingualText | null
  risks_or_limits: BilingualText | null
  model: string | null
  prompt_version: string | null
  enriched_at: string | null
}

type DebugResult = {
  logs: LogEntry[]
  connection: Connection | null
  enrichment_a: Enrichment | null
  enrichment_b: Enrichment | null
  wish_a: Wish | null
  wish_b: Wish | null
  connection_enrichment: ConnectionEnrichment | null
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

const matchTypeBadge: Record<string, string> = {
  strong:        'bg-indigo-100 text-indigo-800 border-indigo-300',
  complementary: 'bg-blue-100 text-blue-800 border-blue-300',
  similar:       'bg-slate-100 text-slate-700 border-slate-300',
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

function EnrichmentCard({ enrichment, label }: { enrichment: Enrichment | null; label: string }) {
  if (!enrichment) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
        <p className="text-slate-400 text-sm">אין נתוני ניתוח</p>
      </div>
    )
  }
  const arr = (a: string[] | null | undefined) => (a?.length ? a.join(', ') : '—')
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <Pill label="תחום" value={enrichment.primary_domain ?? '—'} />
        <Pill label="כוונה" value={enrichment.intent ?? '—'} />
        <Pill label="שיתוף פעולה" value={enrichment.collaboration_type ?? '—'} />
      </div>

      {enrichment.themes?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">נושאים</p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.themes.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <Pill label="צרכים" value={arr(enrichment.needs)} />
        <Pill label="יכולות" value={arr(enrichment.skills_offered)} />
        <Pill label="ישויות סובייקט" value={arr(enrichment.subject_entities)} />
        <Pill label="ישויות תחום" value={arr(enrichment.domain_entities)} />
      </div>

      {enrichment.location_name && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">מיקום</p>
          <p className="text-slate-800 font-medium">{enrichment.location_name}</p>
          {enrichment.location_lat != null && (
            <p className="text-slate-400 text-xs" dir="ltr">
              {enrichment.location_lat.toFixed(5)}, {enrichment.location_lng?.toFixed(5)}
            </p>
          )}
        </div>
      )}

      {(enrichment.date_range_start || enrichment.date_range_end) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">טווח זמן</p>
          <p className="text-slate-800 font-medium" dir="ltr">
            {enrichment.date_range_start ?? '(פתוח)'} → {enrichment.date_range_end ?? '(לעד)'}
          </p>
        </div>
      )}
    </div>
  )
}

function ScoreMeter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`text-sm font-black ${color}`}>{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function BilingualBlock({ label, value }: { label: string; value: BilingualText | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm text-slate-800 leading-relaxed">{value.he}</p>
      {value.en && value.en !== value.he && (
        <p className="text-xs text-slate-400 leading-relaxed italic" dir="ltr">{value.en}</p>
      )}
    </div>
  )
}

const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  high_resonance_strong_collaboration: 'תהודה גבוהה + שיתוף פעולה חזק',
  high_resonance_low_collaboration:    'תהודה גבוהה + שיתוף פעולה נמוך',
  moderate_resonance_practical_match:  'תהודה בינונית + שיתוף פעולה מעשי',
  weak_match:                          'התאמה חלשה',
  unclear:                             'לא ברור',
}

function ConnectionEnrichmentCard({ enrichment }: { enrichment: ConnectionEnrichment | null }) {
  if (!enrichment) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">שיפור חיבור — GPT</p>
        <p className="text-slate-400 text-sm">לא בוצע ניתוח GPT לזוג זה עדיין</p>
      </div>
    )
  }

  const scoreColor = (v: number) =>
    v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">שיפור חיבור — GPT</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-black text-indigo-700">{enrichment.overall_connection_score}</span>
          <span className="text-xs text-slate-400">/ 100</span>
          {enrichment.relationship_type && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
              {RELATIONSHIP_TYPE_LABELS[enrichment.relationship_type] ?? enrichment.relationship_type}
            </span>
          )}
          {enrichment.enriched_at && (
            <span className="text-xs text-slate-400">{fmt(enrichment.enriched_at)}</span>
          )}
        </div>
      </div>

      {/* Score meters */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <ScoreMeter label="תהודה"           value={enrichment.resonance_score}           color={scoreColor(enrichment.resonance_score)} />
        <ScoreMeter label="עומק שיתוף פעולה" value={enrichment.collaboration_depth_score} color={scoreColor(enrichment.collaboration_depth_score)} />
        <ScoreMeter label="ציון כולל"        value={enrichment.overall_connection_score}  color={scoreColor(enrichment.overall_connection_score)} />
        <ScoreMeter label="ביטחון המודל"     value={enrichment.confidence}               color="text-slate-600" />
      </div>

      {/* Bilingual texts */}
      <div className="space-y-4 border-t border-slate-100 pt-4">
        <BilingualBlock label="מדוע — why"                   value={enrichment.why} />
        <BilingualBlock label="הזדמנות למשאלה א׳"            value={enrichment.opportunity_for_wish_a} />
        <BilingualBlock label="הזדמנות למשאלה ב׳"            value={enrichment.opportunity_for_wish_b} />
        <BilingualBlock label="בסיס משותף — shared basis"    value={enrichment.shared_basis} />
        <BilingualBlock label="סיכונים / מגבלות"             value={enrichment.risks_or_limits} />
      </div>

      {/* Model metadata */}
      {(enrichment.model || enrichment.prompt_version) && (
        <p className="text-[10px] text-slate-300 font-mono" dir="ltr">
          model: {enrichment.model} · prompt: {enrichment.prompt_version}
        </p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function ConnectionsDebugPage() {
  const searchParams = useSearchParams()
  const [wishes, setWishes] = useState<Wish[]>([])
  const [wishA, setWishA] = useState(searchParams.get('a') ?? '')
  const [wishB, setWishB] = useState(searchParams.get('b') ?? '')
  const [filterA, setFilterA] = useState('')
  const [filterB, setFilterB] = useState('')
  const [result, setResult] = useState<DebugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [wishListLoading, setWishListLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (!wishListLoading && wishA && wishB && wishA !== wishB) {
      fetchDebug()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishListLoading])

  const filteredWishes = (filter: string) =>
    wishes.filter(w =>
      filter.length < 2 ||
      w.original_text.includes(filter) ||
      w.id.startsWith(filter) ||
      (w.contact_name ?? '').includes(filter)
    ).slice(0, 120)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">MATCHES DEBUG</h1>
        <p className="text-sm text-slate-500 mt-1">תחקור חיבורים בין משאלות</p>
      </div>

      {/* Wish selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">בחר זוג משאלות לבדיקה</p>

        {wishListLoading && <p className="text-slate-400 text-sm">טוען משאלות…</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { label: 'משאלה א׳', filter: filterA, setFilter: setFilterA, value: wishA, setValue: setWishA },
            { label: 'משאלה ב׳', filter: filterB, setFilter: setFilterB, value: wishB, setValue: setWishB },
          ].map(({ label, filter, setFilter, value, setValue }) => (
            <div key={label} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">{label}</label>
              <input
                type="text"
                placeholder="חפש לפי טקסט, שם, UUID…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <select
                size={6}
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                style={{ height: '180px' }}
              >
                <option value="">— בחר משאלה —</option>
                {filteredWishes(filter).map(w => (
                  <option key={w.id} value={w.id}>
                    {truncate(w.original_text)} {w.contact_name ? `(${w.contact_name})` : ''}
                  </option>
                ))}
              </select>
              {value && (
                <p className="text-xs text-slate-400 font-mono break-all" dir="ltr">{value}</p>
              )}
            </div>
          ))}
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
        <div className="space-y-6">

          {/* Wish texts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([['א', result.wish_a], ['ב', result.wish_b]] as const).map(([label, wish]) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">משאלה {label}</p>
                {wish ? (
                  <>
                    <p className="text-slate-800 leading-relaxed text-sm mb-3">{wish.original_text}</p>
                    <div className="text-xs text-slate-400 space-y-1">
                      {wish.contact_name && <p>👤 {wish.contact_name}</p>}
                      {wish.contact_city && <p>📍 {wish.contact_city}{wish.contact_country ? `, ${wish.contact_country}` : ''}</p>}
                      <p>🕐 {fmt(wish.created_at)}</p>
                      <p className="font-mono break-all" dir="ltr">{wish.id}</p>
                    </div>
                  </>
                ) : <p className="text-slate-400 text-sm">לא נמצאה</p>}
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div className={`bg-white rounded-2xl border-2 p-6 shadow-sm ${
            result.connection ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{result.connection ? '🔗' : '⭕'}</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    {result.connection ? 'חיבור קיים ב-wish_connections' : 'אין חיבור ב-wish_connections'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {result.connection
                      ? `נוצר: ${fmt(result.connection.created_at)}`
                      : 'הזוג לא עמד בסף הציון או לא עבר את בדיקות הסינון'}
                  </p>
                </div>
              </div>
              {result.connection && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${matchTypeBadge[result.connection.match_type] ?? 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                    {result.connection.match_type}
                  </span>
                  <span className="text-2xl font-black text-indigo-700">
                    {pct(result.connection.match_score)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                    {result.connection.status}
                  </span>
                  {result.connection.published != null && (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      result.connection.published
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      {result.connection.published ? '✓ פורסם' : '○ לא פורסם'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Connection enrichment (GPT judgment) */}
          <ConnectionEnrichmentCard enrichment={result.connection_enrichment} />

          {/* Match attempts log */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                match_attempts_log ({result.logs.length} רשומות)
              </p>
              {result.logs.length === 0 && (
                <span className="text-slate-400 text-sm">לא נרשמו ניסיונות בין הזוג הזה</span>
              )}
            </div>

            {result.logs.length > 0 && (
              <div className="space-y-4">
                {result.logs.map(log => (
                  <div key={log.id} className={`rounded-xl border p-4 space-y-3 ${
                    log.passed_threshold ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
                  }`}>

                    {/* Row header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge ok={log.passed_threshold} label={log.passed_threshold ? 'עבר סף' : 'לא עבר סף'} />
                        {log.connection_rank != null && (() => {
                          const created = result.connection != null
                          return (
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border tabular-nums ${
                              !created
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : log.connection_rank === 1
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            }`}>
                              #{log.connection_rank}{!created ? ' נחתך' : ''}
                            </span>
                          )
                        })()}
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded" dir="ltr">
                          {log._direction}
                        </span>
                        {log.match_type && (
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${matchTypeBadge[log.match_type] ?? 'bg-slate-100 border-slate-200 text-slate-700'}`}>
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
                      <span className="text-xs text-slate-400">{fmt(log.created_at)}</span>
                    </div>

                    {log.gate_passed === false && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        log.gate_reason === 'date_range_mismatch'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {log.gate_reason === 'date_range_mismatch' ? '📅 אין חפיפת זמן' : `⛔ ${log.gate_reason}`}
                      </span>
                    )}

                    {/* Score breakdown — v13: match_score = semantic_similarity */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Pill label="ציון כולל" value={
                        <span className="text-base font-black text-indigo-700">{pct(log.match_score)}</span>
                      } />
                      <Pill label="סמנטי" value={pct(log.semantic_similarity)} />
                      <Pill label="משלימות (obs.)" value={pct(log.complementarity_score)} />
                      <Pill label="מבנה (obs.)" value={log.structural_similarity != null ? pct(log.structural_similarity) : '—'} />
                      <Pill label="עונש מרחק" value={
                        log.geo_penalty != null && log.geo_penalty < 1
                          ? <span className="text-orange-600 font-semibold">{num(log.geo_penalty, 3)}</span>
                          : <span className="text-slate-400">1.000</span>
                      } />
                    </div>

                    <p className="text-[10px] font-mono text-slate-300 break-all" dir="ltr">id: {log.id}</p>
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
  )
}
