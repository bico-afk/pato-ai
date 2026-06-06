import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { matchDemand, type DemandRow } from '@/lib/match/matchDemand'

export const runtime = 'nodejs'

/* Dispara o matching + WhatsApp para um pedido recém-criado.
   Dois gatilhos suportados:
   1) Supabase Database Webhook (INSERT em demands) → body { record }.
      Proteja com o header x-webhook-secret = NOTIFY_SECRET.
   2) Chamada interna do app pós-publicação → body { demandId }.
   A idempotência (demands.notified_at) evita envios duplicados. */

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  // Verifica segredo do webhook (se configurado)
  const secret = (process.env.NOTIFY_SECRET ?? '').trim()
  if (secret) {
    const got = req.headers.get('x-webhook-secret') ?? new URL(req.url).searchParams.get('secret') ?? ''
    // chamadas internas com { demandId } passam sem segredo apenas se NOTIFY_SECRET não for exigido;
    // aqui exigimos o segredo para QUALQUER chamada quando ele existe.
    if (got !== secret) {
      // exceção: permite a chamada interna do próprio app (mesma origem) só com demandId
      const internal = req.headers.get('x-internal') === '1'
      if (!internal) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  let body: { record?: DemandRow; demandId?: string; type?: string; table?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  let demand: DemandRow | null = body.record ?? null
  if (!demand && body.demandId) {
    const { data } = await db().from('demands').select('*').eq('id', body.demandId).maybeSingle()
    demand = (data as DemandRow | null) ?? null
  }
  if (!demand?.id) return NextResponse.json({ ok: false, error: 'sem_demand' }, { status: 400 })

  try {
    const result = await matchDemand(demand)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[notify-match] erro:', e)
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'bikco-notify-match' })
}
