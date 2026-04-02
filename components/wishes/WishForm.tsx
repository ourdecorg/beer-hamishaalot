'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WishContactInfo } from '@/lib/types'
import SettlementPicker from './SettlementPicker'
import { useLang } from '@/components/LangProvider'
import { t } from '@/lib/i18n'

const emptyContact: WishContactInfo = {
  contact_name: '',
  contact_country: 'Israel',
  contact_city: '',
  contact_address: '',
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
  const router = useRouter()

  const setContactField = (field: keyof WishContactInfo, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || status === 'loading') return

    if (!consent) {
      setConsentError(true)
      return
    }

    setStatus('loading')
    setErrorMsg('')

    const body: Record<string, unknown> = {
      original_text: text.trim(),
      visibility: 'open',
      contact,
      consent_to_match_sharing: true,
    }

    const res = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

      <div className="card p-6 space-y-4 bg-slate-50">
        <p className="text-sm font-medium text-slate-700">{tr.contactTitle}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.cityLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            <SettlementPicker
              value={contact.contact_city}
              onChange={(v) => setContactField('contact_city', v)}
              disabled={status === 'loading'}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.addressLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            <input
              type="text"
              value={contact.contact_address}
              onChange={(e) => setContactField('contact_address', e.target.value)}
              placeholder={tr.addressPlaceholder}
              disabled={status === 'loading'}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">
              {tr.phoneLabel} <span className="text-slate-400">{tr.optional}</span>
            </label>
            <input
              type="tel"
              value={contact.contact_phone}
              onChange={(e) => setContactField('contact_phone', e.target.value)}
              placeholder={tr.phonePlaceholder}
              disabled={status === 'loading'}
              className="input-base"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Consent checkbox */}
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
          <>
            <span>{tr.submitBtn}</span>
          </>
        )}
      </button>

      <p className="text-xs text-center text-slate-400">{tr.afterSubmit}</p>
    </form>
  )
}
