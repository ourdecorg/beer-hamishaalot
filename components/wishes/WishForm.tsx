'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WishVisibility, WishContactInfo } from '@/lib/types'

const visibilityOptions: {
  value: WishVisibility
  label: string
  sublabel: string
  icon: string
}[] = [
  {
    value: 'private',
    label: 'פרטי',
    sublabel: 'רק אתה רואה את זה',
    icon: '🔒',
  },
  {
    value: 'anonymous',
    label: 'אנונימי',
    sublabel: 'גלוי לכולם, ללא שמך',
    icon: '🎭',
  },
  {
    value: 'open',
    label: 'פתוח',
    sublabel: 'גלוי עם פרטי קשר',
    icon: '✦',
  },
]

const emptyContact: WishContactInfo = {
  contact_name: '',
  contact_email: '',
  contact_country: '',
  contact_city: '',
  contact_address: '',
  contact_phone: '',
}

export default function WishForm() {
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<WishVisibility>('anonymous')
  const [contact, setContact] = useState<WishContactInfo>(emptyContact)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const setContactField = (field: keyof WishContactInfo, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || status === 'loading') return

    setStatus('loading')
    setErrorMsg('')

    const body: Record<string, unknown> = { original_text: text.trim(), visibility }
    if (visibility === 'open') {
      body.contact = contact
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
      setErrorMsg((data.error ?? 'אירעה שגיאה. נסה שוב.') + detail)
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
      {/* Text area */}
      <div>
        <label
          htmlFor="wish-text"
          className="block text-sm font-medium text-well-700 mb-2"
        >
          מה משאלתך?
        </label>
        <textarea
          id="wish-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="שתף את מה שנמצא בלבך. זה יכול להיות חלום, כוונה, תקווה, או כל דבר שרצונך שיתגשם..."
          rows={6}
          maxLength={1000}
          required
          disabled={status === 'loading'}
          className={`input-base resize-none leading-relaxed ${
            isOverLimit ? 'ring-2 ring-red-400 border-red-300' : ''
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-sand-400">
            שתף בחופשיות — הבאר מקשיבה
          </span>
          <span
            className={`text-xs ${
              isOverLimit
                ? 'text-red-500'
                : isNearLimit
                ? 'text-amber-600'
                : 'text-sand-400'
            }`}
          >
            {charCount}/1000
          </span>
        </div>
      </div>

      {/* Visibility selector */}
      <div>
        <p className="block text-sm font-medium text-well-700 mb-3">
          מי יראה את המשאלה?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {visibilityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVisibility(opt.value)}
              disabled={status === 'loading'}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center
                ${
                  visibility === opt.value
                    ? 'border-well-500 bg-well-50 shadow-sm'
                    : 'border-sand-200 bg-white hover:border-sand-300 hover:bg-sand-50'
                }
              `}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span
                className={`text-sm font-medium ${
                  visibility === opt.value ? 'text-well-800' : 'text-well-600'
                }`}
              >
                {opt.label}
              </span>
              <span className="text-xs text-sand-400 leading-tight">{opt.sublabel}</span>
              {visibility === opt.value && (
                <span className="absolute top-2 left-2 text-well-500 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contact info — only for open wishes */}
      {visibility === 'open' && (
        <div className="card p-6 space-y-4 border-well-200 bg-well-50/40">
          <p className="text-sm font-medium text-well-700">
            ✦ פרטי קשר — יוצגו עם המשאלה
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                שם <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={contact.contact_name}
                onChange={(e) => setContactField('contact_name', e.target.value)}
                placeholder="השם שלך"
                required
                disabled={status === 'loading'}
                className="input-base"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                אימייל <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={contact.contact_email}
                onChange={(e) => setContactField('contact_email', e.target.value)}
                placeholder="your@email.com"
                required
                disabled={status === 'loading'}
                className="input-base"
                dir="ltr"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                ארץ <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={contact.contact_country}
                onChange={(e) => setContactField('contact_country', e.target.value)}
                placeholder="ישראל"
                required
                disabled={status === 'loading'}
                className="input-base"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                ישוב <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={contact.contact_city}
                onChange={(e) => setContactField('contact_city', e.target.value)}
                placeholder="תל אביב"
                required
                disabled={status === 'loading'}
                className="input-base"
              />
            </div>

            {/* Address — optional */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                כתובת <span className="text-sand-400">(לא חובה)</span>
              </label>
              <input
                type="text"
                value={contact.contact_address}
                onChange={(e) => setContactField('contact_address', e.target.value)}
                placeholder="רחוב ומספר בית"
                disabled={status === 'loading'}
                className="input-base"
              />
            </div>

            {/* Phone — optional */}
            <div>
              <label className="block text-xs text-well-600 mb-1">
                טלפון <span className="text-sand-400">(לא חובה)</span>
              </label>
              <input
                type="tel"
                value={contact.contact_phone}
                onChange={(e) => setContactField('contact_phone', e.target.value)}
                placeholder="050-0000000"
                disabled={status === 'loading'}
                className="input-base"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!text.trim() || isOverLimit || status === 'loading'}
        className="btn-primary w-full justify-center text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>שולח ומעשיר עם AI...</span>
          </>
        ) : (
          <>
            <span>✦</span>
            <span>שלח את המשאלה</span>
          </>
        )}
      </button>

      <p className="text-xs text-center text-sand-400">
        לאחר השליחה, הבינה המלאכותית תעמיק ותעשיר את משאלתך
      </p>
    </form>
  )
}
