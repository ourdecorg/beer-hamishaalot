'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WishContactInfo } from '@/lib/types'
import SettlementPicker from './SettlementPicker'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'

interface Country {
  id: number
  alpha2: string
  name: string
}

const FALLBACK_COUNTRIES: Country[] = [
  { id: 376, alpha2: 'il', name: 'Israel' },
]

const emptyContact: WishContactInfo = {
  contact_name: '',
  contact_country: 'Israel',
  contact_city: '',
  contact_phone: '',
}

interface WishFormProps {
  initialText?: string
}

export default function WishForm({ initialText = '' }: WishFormProps) {
  const lang = useLang()
  const tr = t(lang).wishForm

  const [text, setText] = useState(initialText)
  const [contact, setContact] = useState<WishContactInfo>(emptyContact)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [countries, setCountries] = useState<Country[]>(FALLBACK_COUNTRIES)
  const router = useRouter()

  // Pre-fill from profile + load countries list in parallel
  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((r) => r.json()).catch(() => null),
      fetch('/api/countries').then((r) => r.json()).catch(() => null),
    ]).then(([profile, countryList]) => {
      if (Array.isArray(countryList) && countryList.length > 0) {
        setCountries(countryList)
      }
      if (profile && !profile.error) {
        setContact((prev) => ({
          ...prev,
          contact_name:    profile.display_name ?? prev.contact_name,
          contact_country: profile.country      ?? prev.contact_country,
          contact_city:    profile.city         ?? prev.contact_city,
          contact_phone:   profile.phone        ?? prev.contact_phone,
        }))
      }
    })
  }, [])

  const setContactField = (field: keyof WishContactInfo, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }))
  }

  const handleCountryChange = (value: string) => {
    // Clear city when switching away from Israel (settlement names don't apply)
    const wasIsrael = contact.contact_country === 'Israel'
    const isNowIsrael = value === 'Israel'
    setContact((prev) => ({
      ...prev,
      contact_country: value,
      contact_city: wasIsrael !== isNowIsrael ? '' : prev.contact_city,
    }))
  }

  const isIsrael = contact.contact_country === 'Israel'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || status === 'loading') return

    if (!consent) {
      setConsentError(true)
      return
    }

    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_text: text.trim(),
        visibility: 'open',
        contact,
        consent_to_match_sharing: true,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setStatus('error')
      const detail = data.detail ? ` (${data.detail})` : ''
      setErrorMsg((data.error ?? tr.errorGeneric) + detail)
      return
    }

    const wish = await res.json()
    router.push(`/wishes/${wish.id}`)
  }

  const charCount = text.length
  const isNearLimit = charCount > 900
  const isOverLimit = charCount > 1000

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Wish text */}
      <div>
        <label htmlFor="wish-text" className="block text-sm font-medium text-slate-700 mb-2">
          {tr.label}
        </label>
        <textarea
          id="wish-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tr.placeholder}
          rows={6}
          maxLength={1000}
          required
          disabled={status === 'loading'}
          className={`input-base resize-none leading-relaxed ${
            isOverLimit ? 'ring-2 ring-red-400 border-red-300' : ''
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-slate-400">{tr.hint}</span>
          <span
            className={`text-xs ${
              isOverLimit ? 'text-red-500' : isNearLimit ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            {charCount}/1000
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2">{tr.consentHelper}</p>
      </div>

      {/* Contact details — order: name, country, city, phone */}
      <div className="card p-6 space-y-4 bg-slate-50">
        <p className="text-sm font-medium text-slate-700">{tr.contactTitle}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.nameLabel} <span className="text-red-400">{tr.nameRequired}</span>
            </label>
            <input
              type="text"
              value={contact.contact_name}
              onChange={(e) => setContactField('contact_name', e.target.value)}
              placeholder={tr.namePlaceholder}
              required
              disabled={status === 'loading'}
              className="input-base"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.countryLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            <select
              value={contact.contact_country}
              onChange={(e) => handleCountryChange(e.target.value)}
              disabled={status === 'loading'}
              className="input-base bg-white"
            >
              {countries.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* City — SettlementPicker for Israel, free text otherwise */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.cityLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            {isIsrael ? (
              <SettlementPicker
                value={contact.contact_city}
                onChange={(v) => setContactField('contact_city', v)}
                disabled={status === 'loading'}
              />
            ) : (
              <input
                type="text"
                value={contact.contact_city}
                onChange={(e) => setContactField('contact_city', e.target.value)}
                placeholder={tr.cityPlaceholder}
                disabled={status === 'loading'}
                className="input-base"
              />
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.phoneLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            <input
              type="tel"
              value={contact.contact_phone ?? ''}
              onChange={(e) => setContactField('contact_phone', e.target.value)}
              placeholder={tr.phonePlaceholder}
              disabled={status === 'loading'}
              className="input-base"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Consent */}
      <div
        className={`rounded-xl border p-4 ${
          consentError ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <label className="flex gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="consent-checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked)
              if (e.target.checked) setConsentError(false)
            }}
            disabled={status === 'loading'}
            aria-describedby={consentError ? 'consent-error' : undefined}
            aria-invalid={consentError}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-indigo-600 cursor-pointer"
          />
          <span className="text-sm text-slate-700 leading-relaxed">
            {tr.consentLabel}{' '}
            <Link href="/privacy" className="text-indigo-600 hover:underline" target="_blank">
              {t(lang).footer.privacy}
            </Link>
          </span>
        </label>
        {consentError && (
          <p id="consent-error" role="alert" className="mt-2 text-sm text-amber-700">
            {tr.consentError}
          </p>
        )}
      </div>

      {status === 'error' && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!text.trim() || isOverLimit || status === 'loading'}
        className="btn-primary w-full justify-center text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>{tr.submitting}</span>
          </>
        ) : (
          <span>{tr.submitBtn}</span>
        )}
      </button>

      <p className="text-xs text-center text-slate-400">{tr.afterSubmit}</p>
    </form>
  )
}
