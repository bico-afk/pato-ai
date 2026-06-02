'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Fetch wrapper that HARD-ABORTS any request hanging longer than `TIMEOUT_MS`.
 *
 * Critical detail: supabase-js sometimes passes its own `signal` (e.g. during
 * token refresh). A naive wrapper that only aborts its own controller would
 * then never actually abort that request — letting a stalled token refresh hang
 * forever and (via the auth lock) freeze every subsequent query permanently.
 * This is why the feed worked for a few minutes and then died on the auto-refresh.
 *
 * Here we ALWAYS drive the request with our own controller, and also forward an
 * upstream abort into it — so the 10s timeout is guaranteed to apply.
 */
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

export function createClient() {
  if (!client) {
    // Use the DEFAULT auth lock (navigatorLock). The earlier deadlock came from
    // React StrictMode double-mounting in dev — now disabled in next.config.ts —
    // not from the lock itself. (A previous custom `processLock` could poison all
    // queries if a refresh hung; combined with the fetch timeout above, the
    // default lock is the safe, battle-tested choice.)
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: fetchWithTimeout },
      }
    )
  }
  return client
}
