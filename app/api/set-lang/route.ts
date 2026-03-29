import { cookies } from 'next/headers'
import type { Lang } from '@/lib/i18n'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const lang: Lang = body.lang === 'he' ? 'he' : 'en'

  const c = await cookies()
  c.set('lang', lang, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })

  return Response.json({ ok: true })
}
