'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Fetch wrapper that aborts requests that hang longer than `TIMEOUT_MS`,
 * so a stalled network call can never freeze the UI forever.
 */
const TIMEOUT_MS = 10_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const signal = init?.signal ?? controller.signal
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}

/**
 * In-process lock (equivalent to supabase-js `processLock`).
 *
 * The default supabase-js auth client serializes token access through the Web
 * Locks API (`navigator.locks`). Under React 19 StrictMode double-mounting, a
 * `navigator.locks` acquisition can be left dangling and never released,
 * deadlocking EVERY subsequent query and the realtime connection (the request
 * hangs before fetch is even called).
 *
 * The opposite extreme — a no-op lock — removes serialization entirely and lets
 * concurrent token refreshes race, rotating each other's refresh tokens and
 * causing an auth-error / re-render storm (infinite loop).
 *
 * `processLock` is the correct middle ground: it serializes auth access PER
 * lock-name in memory (within the tab), without touching `navigator.locks`.
 * No deadlock, no concurrent-refresh storm.
 *
 * NOTE: `@supabase/auth-js@2.69.1` ships `processLock` but does NOT re-export it
 * from the package index (only `navigatorLock` is exported). To avoid a fragile
 * deep import into the package's `dist/`, we implement the identical pattern here.
 */
const lockChains = new Map<string, Promise<void>>()

async function processLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previous = lockChains.get(name) ?? Promise.resolve()

  let release!: () => void
  const current = new Promise<void>(resolve => { release = resolve })

  // Queue this acquisition behind any in-flight one for the same name.
  lockChains.set(name, previous.then(() => current))

  await previous // wait for the previous holder to release
  try {
    return await fn()
  } finally {
    release()
  }
}

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { lock: processLock },
        global: { fetch: fetchWithTimeout },
      }
    )
  }
  return client
}
