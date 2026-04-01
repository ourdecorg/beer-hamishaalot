import type { Metadata } from 'next'
import { Heebo, Rubik } from 'next/font/google'
import './globals.css'
import LangProvider from '@/components/LangProvider'
import { getLang } from '@/lib/i18n/server'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-rubik',
  display: 'swap',
})

// Force all pages to be dynamic — the app always needs live auth/DB state
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL
      ? /^https?:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL)
        ? process.env.NEXT_PUBLIC_SITE_URL
        : `https://${process.env.NEXT_PUBLIC_SITE_URL}`
      : 'http://localhost:3000'
  ),
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
    <html lang={lang} dir={dir} className={`${heebo.variable} ${rubik.variable}`}>
      <body className="antialiased">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  )
}
