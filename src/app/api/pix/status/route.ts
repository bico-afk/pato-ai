import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ASAAS_BASE = process.env.ASAAS_ENV === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3'

const ASAAS_KEY = process.env.ASAAS_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { pagamento_id } = await req.json()
    if (!pagamento_id) return NextResponse.json({ error: 'pagamento_id obrigatório' }, { status: 400 })

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    )

    const { data: pag } = await supabase.from('pagamentos').select('*').eq('id', pagamento_id).single()
    if (!pag) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

    // Se já confirmado ou além, retorna estado atual
    if (pag.status !== 'aguardando') {
      return NextResponse.json({ status: pag.status, confirmado: true })
    }

    /* ── Verifica no Asaas ── */
    if (ASAAS_KEY && ASAAS_KEY.length > 10 && pag.asaas_payment_id) {
      const res = await fetch(`${ASAAS_BASE}/payments/${pag.asaas_payment_id}`, {
        headers: { access_token: ASAAS_KEY }
      })
      const data = await res.json()

      if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
        await supabase.from('pagamentos').update({ status: 'confirmado' }).eq('id', pagamento_id)

        // Notificar ambas as partes
        await supabase.from('notificacoes').insert([
          {
            user_id: pag.contratante_id,
            tipo: 'pagamento_confirmado',
            titulo: '✅ Pagamento confirmado!',
            mensagem: 'Seu pagamento via Pix foi confirmado. O valor está retido com segurança.',
            link: `/pato-pay/${pag.contrato_id}`,
            lida: false,
          },
          {
            user_id: pag.prestador_id,
            tipo: 'pagamento_confirmado',
            titulo: '💰 Pagamento recebido!',
            mensagem: 'O contratante realizou o pagamento. Acompanhe a liberação por etapas.',
            link: `/pato-pay/${pag.contrato_id}`,
            lida: false,
          },
        ]).then(() => {})

        return NextResponse.json({ status: 'confirmado', confirmado: true })
      }
    }

    return NextResponse.json({ status: pag.status, confirmado: false })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 })
  }
}
