/* Rate limiting simples por janela fixa, em memória.
   ATENÇÃO: serverless (Vercel) tem instâncias efêmeras, então isto é uma
   PRIMEIRA defesa (best-effort) contra abuso/loop. Para 10M de usuários,
   trocar por um store distribuído (Upstash Redis) usando a mesma assinatura.
   // TODO: swap para @upstash/ratelimit quando houver REDIS_URL. */

interface Bucket { count: number; reset: number }
const store = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of store) if (now > b.reset) store.delete(k)
}

export interface RateResult { ok: boolean; remaining: number; retryAfter: number }

/** Permite `limit` chamadas por `windowMs` para a mesma `key`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  sweep(now)
  const b = store.get(key)
  if (!b || now > b.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.reset - now) / 1000) }
  }
  b.count++
  return { ok: true, remaining: limit - b.count, retryAfter: 0 }
}

/** Extrai o IP do cliente dos headers (Vercel/proxies). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Resposta 429 padrão. */
export function tooMany(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ ok: false, error: 'rate_limited', retryAfter }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } },
  )
}
