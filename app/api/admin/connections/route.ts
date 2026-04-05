import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  return !!(user && adminEmail && user.email === adminEmail)
}

/**
 * GET /api/admin/connections
 *   → { wishes: [...] }          — full wish list for the selector
 *
 * GET /api/admin/connections?a=<uuid>&b=<uuid>
 *   → { logs, connection, enrichment_a, enrichment_b, wish_a, wish_b }
 */
export async function GET(request: NextRequest) {
  const authClient = await createClient()
  if (!(await checkAdmin(authClient))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client for all data queries — bypasses RLS on internal tables
  const supabase = createAdminClient()

  const { searchParams } = new URL(request.url)
  const wishA = searchParams.get('a')
  const wishB = searchParams.get('b')

  // ── Wish list (no pair selected) ──────────────────────────────
  if (!wishA || !wishB) {
    const { data: wishes, error } = await supabase
      .from('wishes')
      .select('id, original_text, created_at, visibility, contact_name')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ wishes })
  }

  // ── Pair debug data ────────────────────────────────────────────
  const [logsAB, logsBA, connResult, enrichA, enrichB, wishAResult, wishBResult, connEnrichResult] =
    await Promise.all([
      // A→B attempts
      supabase
        .from('match_attempts_log')
        .select('*')
        .eq('wish_id', wishA)
        .eq('candidate_wish_id', wishB)
        .order('created_at', { ascending: false }),

      // B→A attempts
      supabase
        .from('match_attempts_log')
        .select('*')
        .eq('wish_id', wishB)
        .eq('candidate_wish_id', wishA)
        .order('created_at', { ascending: false }),

      // Connection (canonical order: wish_a < wish_b by uuid string)
      supabase
        .from('wish_connections')
        .select('*')
        .or(
          `and(wish_a.eq.${wishA},wish_b.eq.${wishB}),and(wish_a.eq.${wishB},wish_b.eq.${wishA})`
        )
        .maybeSingle(),

      // Wish enrichment A
      supabase
        .from('wish_enrichment')
        .select('*')
        .eq('wish_id', wishA)
        .maybeSingle(),

      // Wish enrichment B
      supabase
        .from('wish_enrichment')
        .select('*')
        .eq('wish_id', wishB)
        .maybeSingle(),

      // Wish A text + contact
      supabase
        .from('wishes')
        .select('id, original_text, created_at, visibility, contact_name, contact_email, contact_city, contact_country')
        .eq('id', wishA)
        .single(),

      // Wish B text + contact
      supabase
        .from('wishes')
        .select('id, original_text, created_at, visibility, contact_name, contact_email, contact_city, contact_country')
        .eq('id', wishB)
        .single(),

      // Connection enrichment (GPT judgment for this pair)
      supabase
        .from('connection_enrichment')
        .select('*')
        .or(
          `and(wish_a_id.eq.${wishA},wish_b_id.eq.${wishB}),and(wish_a_id.eq.${wishB},wish_b_id.eq.${wishA})`
        )
        .maybeSingle(),
    ])

  // Merge both directions, sort by date desc
  const logs = [
    ...(logsAB.data ?? []).map(r => ({ ...r, _direction: `A→B` })),
    ...(logsBA.data ?? []).map(r => ({ ...r, _direction: `B→A` })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({
    logs,
    connection: connResult.data ?? null,
    enrichment_a: enrichA.data ?? null,
    enrichment_b: enrichB.data ?? null,
    wish_a: wishAResult.data ?? null,
    wish_b: wishBResult.data ?? null,
    connection_enrichment: connEnrichResult.data ?? null,
  })
}
