'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Fetch wrapper that aborts requests that hang longer than `TIMEOUT_MS`,
 * so a stalled network call can never freeze the UI forever.
 */
const TIMEOUT_MS = 12_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const signal = init?.signal ?? controller.signal
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}

/**
 * No-op lock. The default supabase-js auth client serializes token access
 * through the Web Locks API (`navigator.locks`). Under React StrictMode
 * double-mounting (and some browser states) a lock can be acquired and never
 * released, deadlocking EVERY subsequent query AND the realtime connection —
 * the request hangs before fetch is even called. We run the callback directly
 * instead. Safe here: the app is used in a single tab and cross-tab session
 * sync still works via storage events.
 */
async function noopLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn()
}

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { lock: noopLock },
        global: { fetch: fetchWithTimeout },
      }
    )
  }
  return client
}
