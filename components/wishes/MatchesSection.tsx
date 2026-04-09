'use client'

import { useEffect, useState } from 'react'
import type { MatchResult, MatchType, ProfileField, UserProfile } from '@/lib/types'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'

const matchTypeCls: Record<MatchType, string> = {
  strong: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  complementary: 'bg-blue-50 border-blue-200 text-blue-700',
  similar: 'bg-slate-100 border-slate-200 text-slate-600',
}

const DISCLOSURE_FIELDS: ProfileField[] = [
  'display_name',
  'email',
  'country',
  'city',
  'phone',
]

interface Props {
  wishId: string
  isAdmin?: boolean
}

// ── Disclosure response panel ─────────────────────────────────────────────────

interface RespondPanelProps {
  connectionId: string
  profile: UserProfile | null
  onResponded: (response: 'accepted' | 'declined' | 'later') => void
  tr: ReturnType<typeof t>['matchesSection']
}

function RespondPanel({ connectionId, profile, onResponded, tr }: RespondPanelProps) {
  const [step, setStep] = useState<'cta' | 'accept-form'>('cta')
  const [selectedFields, setSelectedFields] = useState<Set<ProfileField>>(
    new Set<ProfileField>(['display_name', 'email'])
  )
  const [introMessage, setIntroMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleField(f: ProfileField) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(f)) {
        next.delete(f)
        if (f === 'country') next.delete('city')
      } else {
        next.add(f)
        if (f === 'city') next.add('country')
      }
      return next
    })
  }

  async function submitResponse(
    response: 'accepted' | 'declined' | 'later',
    fields: string[] = [],
    intro: string | null = null
  ) {
    setSaving(true)
    try {
      await fetch(`/api/connections/${connectionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, shared_fields: fields, intro_message: intro }),
      })
      onResponded(response)
    } finally {
      setSaving(false)
    }
  }

  const profileHasData = profile
    ? DISCLOSURE_FIELDS.some((f) => profile[f as keyof UserProfile])
    : false

  if (step === 'accept-form') {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-emerald-800">{tr.shareFieldsLabel}</p>

        {!profileHasData && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {tr.profileEmptyHint}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {DISCLOSURE_FIELDS.map((f) => {
            const value = profile?.[f as keyof UserProfile] as string | null
            const label = tr.fieldLabels[f as keyof typeof tr.fieldLabels]
            const isChecked = selectedFields.has(f)
            const hasValue = !!value
            return (
              <label
                key={f}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors ${
                  isChecked
                    ? 'border-emerald-400 bg-white'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${!hasValue ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-600"
                  checked={isChecked}
                  disabled={!hasValue}
                  onChange={() => toggleField(f)}
                />
                <span className="flex flex-col">
                  <span className="font-medium text-slate-700">{label}</span>
                  {hasValue && (
                    <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                      {value}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">{tr.introLabel}</label>
          <textarea
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"
            rows={3}
            placeholder={tr.introPlaceholder}
            value={introMessage}
            onChange={(e) => setIntroMessage(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              submitResponse('accepted', Array.from(selectedFields), introMessage.trim() || null)
            }
            disabled={saving}
            className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {saving ? tr.submitting : tr.submitAccept}
          </button>
          <button
            onClick={() => setStep('cta')}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            ←
          </button>
        </div>
      </div>
    )
  }

  // step === 'cta'
  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-5 space-y-3">
      <p className="text-sm font-semibold text-indigo-800">{tr.disclosureTitle}</p>
      <p className="text-xs text-indigo-600">{tr.disclosureSubtitle}</p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStep('accept-form')}
          disabled={saving}
          className="bg-indigo-600 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {tr.acceptBtn}
        </button>
        <button
          onClick={() => submitResponse('later')}
          disabled={saving}
          className="text-sm text-slate-600 rounded-lg px-4 py-2 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {tr.laterBtn}
        </button>
        <button
          onClick={() => submitResponse('declined')}
          disabled={saving}
          className="text-sm text-red-500 rounded-lg px-4 py-2 border border-red-100 hover:bg-red-50 transition-colors"
        >
          {tr.declineBtn}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatchesSection({ wishId, isAdmin = false }: Props) {
  const lang = useLang()
  const tr = t(lang).matchesSection

  const matchTypeLabel: Record<MatchType, string> = {
    strong: tr.typeStrong,
    complementary: tr.typeComplementary,
    similar: tr.typeSimilar,
  }

  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    fetch(`/api/wishes/${wishId}/matches`)
      .then((r) => r.json())
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))

    // Fetch the user's profile so we know what fields are available to share
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => null)
  }, [wishId])

  // Optimistically update a single match's disclosure state after the user responds
  function handleResponded(connectionId: string, response: 'accepted' | 'declined' | 'later') {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.connection_id !== connectionId) return m
        const myResponse = response
        const otherResponse = m.other_response
        const mutual = myResponse === 'accepted' && otherResponse === 'accepted'
        return {
          ...m,
          my_response: myResponse,
          disclosure_state: mutual
            ? 'mutual_accept'
            : myResponse === 'declined' || otherResponse === 'declined'
            ? 'declined'
            : myResponse === 'accepted' || otherResponse === 'accepted'
            ? 'one_side_accepted'
            : 'pending',
        }
      })
    )
  }

  if (loading) {
    return (
      <div className="mt-10 card p-8 text-center">
        <div className="flex justify-center gap-1.5 mb-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-indigo-400"
              style={{ animation: `pulse-soft 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <p className="text-slate-500 text-sm">{tr.loading}</p>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="mt-10 card p-10 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-slate-600 text-sm font-medium mb-1">{tr.emptyTitle}</p>
        <p className="text-slate-400 text-xs">{tr.emptyEngine}</p>
      </div>
    )
  }

  const isHe = lang === 'he'

  return (
    <div className="mt-10 space-y-3">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-slate-200" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">{tr.sectionTitle}</span>
          <span className="text-xs font-bold text-white bg-indigo-600 px-2 py-0.5 rounded-full">
            {matches.length}
          </span>
        </div>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {matches.map((match) => {
        const opportunityText = match.opportunity
          ? (isHe ? match.opportunity.he : match.opportunity.en) || null
          : null
        const sharedBasisText = match.shared_basis
          ? (isHe ? match.shared_basis.he : match.shared_basis.en) || null
          : null

        const isMutual = match.disclosure_state === 'mutual_accept'
        const isDeclined = match.disclosure_state === 'declined'
        const isWaiting =
          match.disclosure_state === 'one_side_accepted' && match.my_response === 'accepted'
        const needsMyResponse =
          match.my_response === 'pending' || match.my_response === 'later'

        return (
          <div key={match.connection_id} className="card p-6 space-y-4">
            {/* Header row: score + type badge + admin debug */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {match.overall_connection_score != null ? (
                  <span className="text-sm font-black px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800">
                    {match.overall_connection_score}/100
                  </span>
                ) : (
                  <span
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${matchTypeCls[match.match_type]}`}
                  >
                    {matchTypeLabel[match.match_type]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {match.overall_connection_score == null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">{tr.scoreLabel}</span>
                    <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {Math.round(match.match_score * 100)}%
                    </span>
                  </div>
                )}
                {isAdmin && (
                  <a
                    href={`/admin/connections?a=${wishId}&b=${match.matched_wish_id}`}
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                    title={tr.contactDetails}
                  >
                    debug
                  </a>
                )}
              </div>
            </div>

            {/* Matching wish text */}
            {match.matched_wish_text && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4">
                <p className="section-label text-xs mb-2">{tr.matchingWish}</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {match.matched_wish_text.length > 280
                    ? match.matched_wish_text.slice(0, 280) + '…'
                    : match.matched_wish_text}
                </p>
              </div>
            )}

            {/* Opportunity */}
            {opportunityText && (
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg px-4 py-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                  {isHe ? 'מה יכול להיות כאן בשבילך' : 'Why this could matter for you'}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{opportunityText}</p>
              </div>
            )}

            {/* Shared basis */}
            {sharedBasisText && (
              <div className="bg-sky-50 border-l-4 border-sky-400 rounded-lg px-4 py-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-700">
                  {isHe ? 'מה משותף לכם' : 'What you share'}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{sharedBasisText}</p>
              </div>
            )}

            {/* Shared themes */}
            {match.shared_themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {match.shared_themes.map((theme) => (
                  <span key={theme} className="tag-badge text-xs">
                    {theme}
                  </span>
                ))}
              </div>
            )}

            {/* ── Disclosure section ─────────────────────────────────────────── */}

            {/* Declined */}
            {isDeclined && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm text-slate-500 text-center">{tr.declinedState}</p>
              </div>
            )}

            {/* Pending / later — show response panel */}
            {!isDeclined && needsMyResponse && (
              <RespondPanel
                connectionId={match.connection_id}
                profile={profile}
                onResponded={(r) => handleResponded(match.connection_id, r)}
                tr={tr}
              />
            )}

            {/* Accepted, waiting for other side */}
            {!isDeclined && isWaiting && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-sm text-emerald-700 font-medium">{tr.waitingOther}</p>
              </div>
            )}

            {/* Mutual — show the other side's shared snapshot */}
            {isMutual && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤝</span>
                  <p className="text-sm font-semibold text-emerald-800">{tr.mutualTitle}</p>
                </div>
                <p className="text-xs text-emerald-600">{tr.mutualSubtitle}</p>

                {match.other_intro_message && (
                  <div className="bg-white border border-emerald-100 rounded-lg px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
                      {tr.otherIntroLabel}
                    </p>
                    <p className="text-sm text-slate-700 italic">
                      &ldquo;{match.other_intro_message}&rdquo;
                    </p>
                  </div>
                )}

                {match.other_shared_snapshot &&
                Object.keys(match.other_shared_snapshot).length > 0 ? (
                  <div className="bg-white border border-emerald-100 rounded-lg p-4 space-y-2">
                    {(
                      Object.entries(match.other_shared_snapshot) as [
                        ProfileField,
                        string | null,
                      ][]
                    )
                      .filter(([, v]) => v)
                      .map(([field, value]) => (
                        <div key={field} className="flex gap-2 items-baseline">
                          <span className="text-[11px] font-medium text-slate-400 w-24 shrink-0">
                            {tr.fieldLabels[field as keyof typeof tr.fieldLabels] ?? field}
                          </span>
                          {field === 'email' ? (
                            <a
                              href={`mailto:${value}`}
                              className="text-sm text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                              dir="ltr"
                            >
                              {value}
                            </a>
                          ) : field === 'linkedin_url' ? (
                            <a
                              href={value!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                              dir="ltr"
                            >
                              {value}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-800">{value}</span>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{tr.noSharedFields}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
