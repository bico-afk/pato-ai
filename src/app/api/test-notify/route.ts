import { NextRequest, NextResponse } from 'next/server'
import { notifyProfessionals }        from '@/lib/notifyProfessionals'
import { getAuthUser, unauthorized, forbidden, isAdminUser } from '@/lib/auth'

/**
 * POST /api/test-notify  — requer autenticação + role admin
 * Testa o envio de notificação para profissionais sem criar pedido real.
 *
 * Body (todos opcionais):
 *   { "descricao": "...", "categoria": "...", "cidade": "..." }
 */
export async function POST(req: NextRequest) {
  /* ── Auth ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  if (!isAdminUser(user)) return forbidden('Acesso restrito a admins')

  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /* usa defaults */ }

  const payload = {
    id:        `test-${Date.now()}`,
    descricao: body.descricao ?? 'Preciso de um eletricista para instalar tomadas',
    categoria: body.categoria ?? 'Elétrica',
    cidade:    body.cidade    ?? null,
  }

  console.log('[test-notify] iniciando teste com payload:', payload)

  const notified = await notifyProfessionals(payload)

  console.log(`[test-notify] ✓ ${notified} profissional(is) notificado(s)`)

  return NextResponse.json({ ok: true, payload, notified })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  if (!isAdminUser(user)) return forbidden()

  return NextResponse.json({
    ok: true,
    usage: 'POST /api/test-notify com body opcional: { descricao, categoria, cidade }',
  })
}
