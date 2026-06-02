'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * PUBLIC (anon) Supabase client — for reading public data (feed, search,
 * realtime) WITHOUT touching the logged-in user's session.
 *
 * Why this exists: the session-aware browser client (`./client.ts`) calls
 * `auth.getSession()` before every request to attach the user's token. When that
 * token needs refreshing, getSession can deadlock (proven via headless Chrome:
 * after a token refresh the demands query never even hits the network and times
 * out — permanently). Public data doesn't need the user's identity, so we read
 * it through a client that has NO session, NO auto-refresh and NO auth lock.
 * This path is rock-solid (verified stable for minutes).
 *
 * Use `./client.ts` only for operations that require the user's identity
 * (posting, applying, chat, profile).
 */

let pub: ReturnType<typeof createSupabaseClient> | null = null

const TIMEOUT_MS = 10_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const upstream = init?.signal
  if (upstream) {
    if (upstream.aborted) controller.abort()
    else upstream.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export function createPublicClient() {
  if (!pub) {
    pub = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,     // never read/write the user session
          autoRefreshToken: false,   // no background refresh → no refresh deadlock
          detectSessionInUrl: false,
          storageKey: 'sb-public-noauth', // distinct key → no GoTrueClient clash
        },
        global: { fetch: fetchWithTimeout },
      }
    )
  }
  return pub
}
