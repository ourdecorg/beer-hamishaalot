/**
 * OpenAI API call logger.
 *
 * Fire-and-forget insert into openai_api_log — never blocks the pipeline.
 * The embedding vector is intentionally excluded from the response payload
 * (it is stored separately in wish_embeddings).
 */
import { createAdminClient } from '@/lib/supabase/admin'

interface LogEntry {
  caller: string
  model: string
  request: object
  response?: object | null
  error?: string | null
  elapsedMs: number
}

export function logOpenAICall(entry: LogEntry): void {
  const supabase = createAdminClient()
  supabase
    .from('openai_api_log')
    .insert({
      caller:     entry.caller,
      model:      entry.model,
      request:    entry.request,
      response:   entry.response ?? null,
      error:      entry.error ?? null,
      elapsed_ms: entry.elapsedMs,
    })
    .then(({ error }) => {
      if (error) console.error('[openaiLog] insert failed:', error.message)
    })
}
