'use client'

import { useLang } from './LangProvider'
import { t } from '@/lib/i18n'

export default function LanguageSwitcher() {
  const lang = useLang()
  const tr = t(lang)

  async function handleSwitch() {
    const next = lang === 'he' ? 'en' : 'he'
    await fetch('/api/set-lang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: next }),
    })
    window.location.reload()
  }

  return (
    <button
      onClick={handleSwitch}
      className="text-xs font-semibold px-2 py-1 rounded border border-sand-200 text-sand-500 hover:border-well-300 hover:text-well-700 transition-colors"
      title={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
    >
      {tr.lang.switchLabel}
    </button>
  )
}
