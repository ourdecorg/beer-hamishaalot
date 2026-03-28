'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Settlement = {
  id: number
  name: string
  name_en: string | null
  district: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

export default function SettlementPicker({ value, onChange, disabled, required }: Props) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load all settlements once on mount
  useEffect(() => {
    createClient()
      .from('settlements')
      .select('id, name, name_en, district')
      .order('name')
      .limit(2000)
      .then(({ data }) => { if (data) setSettlements(data as Settlement[]) })
  }, [])

  // Sync query when external value resets (e.g. form clear)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.length >= 2
    ? settlements
        .filter(s =>
          s.name.includes(query) ||
          s.name_en?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 25)
    : []

  const handleInput = (val: string) => {
    setQuery(val)
    onChange(val)
    setOpen(true)
  }

  const handleSelect = (s: Settlement) => {
    setQuery(s.name)
    onChange(s.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (query.length >= 2) setOpen(true) }}
        placeholder="חפש ישוב..."
        required={required}
        disabled={disabled}
        className="input-base w-full"
        autoComplete="off"
        dir="rtl"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute right-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-sand-200 bg-white shadow-lg">
          {filtered.map(s => (
            <li
              key={s.id}
              onMouseDown={() => handleSelect(s)}
              className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-sand-50 text-sm"
              dir="rtl"
            >
              <span className="font-medium text-well-800">{s.name}</span>
              {s.district && (
                <span className="text-xs text-sand-400 mr-3">{s.district}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
