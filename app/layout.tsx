import type { Metadata } from 'next'
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google'
import './globals.css'
import LangProvider from '@/components/LangProvider'
import { getLang } from '@/lib/i18n'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-frank-ruhl',
  display: 'swap',
})

// Force all pages to be dynamic — the app always needs live auth/DB state
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'באר המשאלות — Well of Wishes',
  description: 'A sacred space to release your deepest wishes into the universe.',
  openGraph: {
    title: 'באר המשאלות',
    description: 'Cast your wishes into the well. Let them ripple outward.',
    locale: 'he_IL',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const lang = await getLang()
  const dir = lang === 'he' ? 'rtl' : 'ltr'
  return (
    <html lang={lang} dir={dir} className={`${heebo.variable} ${frankRuhl.variable}`}>
      <body className="antialiased">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  )
}
