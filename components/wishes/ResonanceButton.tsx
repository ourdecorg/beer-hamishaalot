'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  wishId: string
  initialCount: number
  initialResonated: boolean
  isAuthenticated: boolean
}

export default function ResonanceButton({
  wishId,
  initialCount,
  initialResonated,
  isAuthenticated,
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [resonated, setResonated] = useState(initialResonated)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (loading) return

    setLoading(true)
    const supabase = createClient()

    if (resonated) {
      // Remove resonance
      const { error } = await supabase
        .from('wish_resonances')
        .delete()
        .eq('wish_id', wishId)

      if (!error) {
        setCount((c) => Math.max(0, c - 1))
        setResonated(false)
      }
    } else {
      // Add resonance
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('wish_resonances')
        .insert({ wish_id: wishId, user_id: user.id })

      if (!error) {
        setCount((c) => c + 1)
        setResonated(true)
      }
    }

    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={resonated ? 'הסר הדהוד' : 'הדהד משאלה זו'}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200 border
        ${
          resonated
            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
            : 'bg-white border-sand-200 text-sand-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
        }
        ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
      `}
    >
      <span
        className={`text-base transition-transform duration-200 ${
          resonated ? 'scale-110' : ''
        }`}
      >
        {resonated ? '💛' : '🤍'}
      </span>
      <span>{count > 0 ? count : ''}</span>
      <span>{resonated ? 'מהדהד' : 'הדהד'}</span>
    </button>
  )
}
