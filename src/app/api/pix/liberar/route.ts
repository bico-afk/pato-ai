import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Etapa {
  id: number
  label: string
  percentual: number
  status: 'pendente' | 'liberada'
  liberado_at: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { pagamento_id, etapa_id } = await req.json()
    if (!pagamento_id || !etapa_id) {
      return NextResponse.json({ error: 'pagamento_id e etapa_id obrigatórios' }, { status: 400 })
    }

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    )

    const { data: pag } = await supabase.from('pagamentos').select('*').eq('id', pagamento_id).single()
    if (!pag) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    if (pag.status === 'aguardando') return NextResponse.json({ error: 'Pagamento ainda não confirmado' }, { status: 400 })

    /* ── Libera etapa ── */
    const etapas: Etapa[] = pag.etapas ?? []
    const etapa = etapas.find((e: Etapa) => e.id === etapa_id)
    if (!etapa) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })
    if (etapa.status === 'liberada') return NextResponse.json({ error: 'Etapa já liberada' }, { status: 400 })

    const valorEtapa = Math.round((pag.valor_total * etapa.percentual) / 100 * 100) / 100
    const novoLiberado = (pag.valor_liberado ?? 0) + valorEtapa

    const updatedEtapas = etapas.map((e: Etapa) =>
      e.id === etapa_id ? { ...e, status: 'liberada', liberado_at: new Date().toISOString() } : e
    )

    const todasLiberadas = (updatedEtapas as Etapa[]).every((e) => e.status === 'liberada')
    const novoStatus = todasLiberadas ? 'concluido' : 'em_execucao'

    await supabase.from('pagamentos').update({
      etapas: updatedEtapas,
      valor_liberado: novoLiberado,
      status: novoStatus,
    }).eq('id', pagamento_id)

    /* ── Notifica prestador ── */
    await supabase.from('notificacoes').insert({
      user_id: pag.prestador_id,
      tipo: 'etapa_liberada',
      titulo: todasLiberadas ? '🎉 Pagamento total liberado!' : `💸 R$ ${valorEtapa.toFixed(2)} liberados!`,
      mensagem: todasLiberadas
        ? 'O serviço foi concluído e o valor total foi liberado. Parabéns!'
        : `"${etapa.label}" foi liberada. R$ ${valorEtapa.toFixed(2)} adicionados ao seu saldo.`,
      link: `/pato-pay/${pag.contrato_id}`,
      lida: false,
    }).then(() => {})

    return NextResponse.json({
      ok: true,
      etapas: updatedEtapas,
      valor_liberado: novoLiberado,
      status: novoStatus,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 })
  }
}
