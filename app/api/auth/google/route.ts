import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const next: string = body.next ?? '/wishes/new'

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  const redirectTo = appUrl
    ? `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? 'Failed to initiate Google login' }, { status: 400 })
  }

  return NextResponse.json({ url: data.url })
}
