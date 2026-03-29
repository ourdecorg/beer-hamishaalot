'use client'

import { createContext, useContext } from 'react'
import type { Lang } from '@/lib/i18n'

const LangCtx = createContext<Lang>('en')

export function useLang(): Lang {
  return useContext(LangCtx)
}

export default function LangProvider({
  lang,
  children,
}: {
  lang: Lang
  children: React.ReactNode
}) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>
}
