import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS entirely.
 * Use ONLY in server-side background operations (matching engine, etc.).
 * Never expose to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
