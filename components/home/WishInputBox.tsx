'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { t, type Lang } from '@/lib/i18n'

interface Props {
  lang: Lang
}

export default function WishInputBox({ lang }: Props) {
  const tr = t(lang).home
  const router = useRouter()
  const [text, setText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    router.push(`/wishes/new?q=${encodeURIComponent(text.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={tr.inputPlaceholder}
        rows={3}
        className="w-full px-5 py-4 text-slate-900 placeholder:text-slate-400 text-base leading-relaxed resize-none focus:outline-none"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSubmit(e as unknown as React.FormEvent)
          }
        }}
      />
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
        <p className="text-sm text-slate-400">{tr.inputHint}</p>
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
        >
          {tr.inputCta}
        </button>
      </div>
    </form>
  )
}
