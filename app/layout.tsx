import type { Metadata } from 'next'
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google'
import './globals.css'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frankRuhl.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
