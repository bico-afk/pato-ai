'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Fetch wrapper that aborts requests that hang longer than `TIMEOUT_MS`.
 * Without this, a stalled Supabase request (auth-lock contention, flaky
 * network, paused project) would never settle and the UI would freeze
 * forever on a loading spinner.
 */
const TIMEOUT_MS = 15_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  // Respect an upstream signal if one was provided, otherwise use our own.
  const signal = init?.signal ?? controller.signal
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}

export function createClient() {
  if (!client) {
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
