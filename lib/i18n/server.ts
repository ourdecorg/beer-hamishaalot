import { cookies } from 'next/headers'
import type { Lang } from './index'

export async function getLang(): Promise<Lang> {
  const c = await cookies()
  const val = c.get('lang')?.value
  return val === 'he' ? 'he' : 'en'
}
