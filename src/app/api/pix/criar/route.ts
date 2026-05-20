import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ASAAS_BASE = process.env.ASAAS_ENV === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3'

const ASAAS_KEY = process.env.ASAAS_API_KEY

/* ── Gera código Pix EMV demo (sem API real) ── */
function pixDemoCode(valor: number, desc: string): string {
  const v = valor.toFixed(2)
  const nome = 'PATO AI PAY'
  const cidade = 'SAO PAULO'
  const txid = Math.random().toString(36).substring(2, 12).toUpperCase()
  const payload =
    '000201' +
    '26330014BR.GOV.BCB.PIX011136c4f3d1-1234-4321-abcd-' + txid +
    '52040000' +
    '5303986' +
    '54' + String(v.length).padStart(2, '0') + v +
    '5802BR' +
    '59' + String(nome.length).padStart(2, '0') + nome +
    '60' + String(cidade.length).padStart(2, '0') + cidade +
    '62070503' + txid.slice(0, 3) +
    '6304'
  // CRC16 simplificado
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
  }
  return payload + ((crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'))
}

export async function POST(req: NextRequest) {
  try {
    const { contrato_id } = await req.json()
    if (!contrato_id) return NextResponse.json({ error: 'contrato_id obrigatório' }, { status: 400 })

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    )

    /* ── Verifica se já existe pagamento ── */
    const { data: existing } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('contrato_id', contrato_id)
      .maybeSingle()

    if (existing) return NextResponse.json({ pagamento: existing })

    /* ── Busca contrato ── */
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, contratante_id, prestador_id, post_id, valor, candidatura_id')
      .eq('id', contrato_id)
      .single()
    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

    /* ── Resolve valor ── */
    let valorTotal: number = contrato.valor ?? 0
    if (!valorTotal && contrato.candidatura_id) {
      const { data: cand } = await supabase.from('candidaturas').select('valor').eq('id', contrato.candidatura_id).single()
      if (cand?.valor) valorTotal = cand.valor
    }
    if (!valorTotal && contrato.post_id) {
      const { data: post } = await supabase.from('posts').select('budget_max, budget_min').eq('id', contrato.post_id).single()
      if (post) valorTotal = post.budget_max ?? post.budget_min ?? 0
    }

    /* ── Título do serviço ── */
    let titulo = 'Serviço Pato AI'
    if (contrato.post_id) {
      const { data: post } = await supabase.from('posts').select('title').eq('id', contrato.post_id).single()
      if (post) titulo = post.title
    }

    /* ── Etapas padrão ── */
    const etapas = [
      { id: 1, label: 'Início do serviço', percentual: 30, status: 'pendente', liberado_at: null },
      { id: 2, label: 'Meio do serviço',   percentual: 40, status: 'pendente', liberado_at: null },
      { id: 3, label: 'Conclusão',          percentual: 30, status: 'pendente', liberado_at: null },
    ]

    let asaasPaymentId: string | null = null
    let pixCopiaECola = pixDemoCode(valorTotal || 1, titulo)
    let qrCodeUrl: string | null = null

    /* ── Asaas (real) ── */
    if (ASAAS_KEY && ASAAS_KEY.length > 10) {
      try {
        // Busca ou cria customer
        const ctProf = await supabase.from('profiles').select('full_name, email:id').eq('id', contrato.contratante_id).single()
        const ctName = (ctProf.data as Record<string, string>)?.full_name ?? 'Cliente'

        // Tenta buscar customer existente
        let customerId: string | null = null
        const custSearch = await fetch(`${ASAAS_BASE}/customers?email=pato-${contrato.contratante_id}@patoai.com`, {
          headers: { access_token: ASAAS_KEY }
        })
        const custData = await custSearch.json()
        if (custData.data?.length > 0) {
          customerId = custData.data[0].id
        } else {
          const custCreate = await fetch(`${ASAAS_BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
            body: JSON.stringify({
              name: ctName,
              email: `pato-${contrato.contratante_id}@patoai.com`,
              cpfCnpj: '00000000000', // placeholder — usuário deve preencher
              notificationDisabled: true,
            })
          })
          const custCreated = await custCreate.json()
          customerId = custCreated.id
        }

        if (customerId) {
          const dueDate = new Date(Date.now() + 30 * 60 * 1000).toISOString().split('T')[0]
          const pmtRes = await fetch(`${ASAAS_BASE}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
            body: JSON.stringify({
              customer: customerId,
              billingType: 'PIX',
              value: valorTotal || 1,
              dueDate,
              description: titulo,
              externalReference: contrato_id,
            })
          })
          const pmtData = await pmtRes.json()
          if (pmtData.id) {
            asaasPaymentId = pmtData.id
            // Busca QR Code
            await new Promise(r => setTimeout(r, 1000)) // aguarda Asaas processar
            const qrRes = await fetch(`${ASAAS_BASE}/payments/${pmtData.id}/pixQrCode`, {
              headers: { access_token: ASAAS_KEY }
            })
            const qrData = await qrRes.json()
            if (qrData.payload) pixCopiaECola = qrData.payload
            if (qrData.encodedImage) qrCodeUrl = `data:image/png;base64,${qrData.encodedImage}`
          }
        }
      } catch (asaasErr) {
        console.error('Asaas error (continuing with demo):', asaasErr)
      }
    }

    /* ── Salva pagamento ── */
    const payload: Record<string, unknown> = {
      contrato_id,
      contratante_id: contrato.contratante_id,
      prestador_id: contrato.prestador_id,
      valor_total: valorTotal,
      valor_liberado: 0,
      status: 'aguardando',
      pix_copia_cola: pixCopiaECola,
      etapas,
    }
    if (asaasPaymentId) payload.asaas_payment_id = asaasPaymentId
    if (qrCodeUrl)      payload.qr_code_url = qrCodeUrl

    const { data: saved, error: saveErr } = await supabase.from('pagamentos').insert(payload).select('*').single()
    if (saveErr) {
      console.error('Erro ao salvar pagamento:', saveErr)
      // Retorna dados mesmo sem salvar
      return NextResponse.json({ pagamento: { ...payload, id: null }, saveError: saveErr.message })
    }

    return NextResponse.json({ pagamento: saved })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
