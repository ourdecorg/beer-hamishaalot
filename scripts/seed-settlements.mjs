#!/usr/bin/env node
/**
 * Seeds the settlements table from the official CBS yishuvim CSV file.
 *
 * Usage:
 *   node scripts/seed-settlements.mjs <path-to-csv>
 *
 * The CSV is the "ישובים" file from CBS (מרכז הסטטיסטי לישראל).
 * It is encoded in Windows-1255. Node 18+ TextDecoder handles this natively.
 *
 * Example:
 *   node scripts/seed-settlements.mjs ~/Downloads/yishuvim.csv
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local ──────────────────────────────────────────────────────────

const envText = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = Object.fromEntries(
  envText.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Parse CSV ────────────────────────────────────────────────────────────────

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/seed-settlements.mjs <path-to-csv>')
  process.exit(1)
}

const buffer = readFileSync(resolve(csvPath))
const text = new TextDecoder('windows-1255').decode(buffer)

// Columns: id, name_he, name_en, district_code, district, office_code, office, council_code, council
const rows = text
  .split('\n')
  .map(l => l.split(',').map(c => c.trim()))
  .filter(cols => cols.length >= 5)

const data = rows
  .slice(1) // skip header
  .map(cols => ({
    id:       parseInt(cols[0]),
    name:     cols[1],
    name_en:  cols[2] || null,
    district: cols[4] || null,
    council:  cols[8] || null,
  }))
  .filter(r => r.id > 0 && r.name) // skip "לא רשום" (id=0)

console.log(`Parsed ${data.length} settlements — inserting...`)

// ── Insert in batches ────────────────────────────────────────────────────────

const BATCH = 100
for (let i = 0; i < data.length; i += BATCH) {
  const batch = data.slice(i, i + BATCH)
  const { error } = await supabase
    .from('settlements')
    .upsert(batch, { onConflict: 'id' })

  if (error) {
    console.error('Insert error:', error.message)
    process.exit(1)
  }
  console.log(`  ✓ ${Math.min(i + BATCH, data.length)}/${data.length}`)
}

console.log('\nDone! Settlements table is ready.')
