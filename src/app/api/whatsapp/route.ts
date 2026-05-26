import { NextRequest, NextResponse }                  from 'next/server'
import { createClient as createSupabase }              from '@supabase/supabase-js'
import { runOnboarding, saveOnboardingProfile, WaMessage } from '@/lib/onboardingAI'

/* ─── Env lida em runtime (não no nível de módulo) ─────────── */
function getZApiCreds() {
  const instance    = (process.env.ZAPI_INSTANCE     ?? '').trim()
  const token       = (process.env.ZAPI_TOKEN        ?? '').trim()
  const clientToken = (process.env.ZAPI_CLIENT_TOKEN ?? '').trim()
  return { instance, token, clientToken }
}

/* ─── Z-API webhook payload (tipos relevantes) ────────────── */
interface ZApiPayload {
  phone:        string        // ex: "5512999990000"
  fromMe:       boolean
  isStatusReply?: boolean
  broadcast?:  boolean
  type:        string         // "ReceivedCallback" | "DeliveryCallback" | …
  text?: { message: string }
  image?: { caption?: string }
  audio?: unknown
  video?: unknown
  document?: unknown
  senderName?: string
  chatName?:   string
}

/* ─── Supabase (service role — bypass RLS) ───────────────── */
function db() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/* ─── Sessão de onboarding por telefone ─────────────────── */
async function getSession(supabase: ReturnType<typeof db>, phone: string): Promise<WaMessage[]> {
  const { data } = await supabase
    .from('wa_sessions')
    .select('messages')
    .eq('phone', phone)
    .single()
  return (data?.messages ?? []) as WaMessage[]
}

async function saveSession(supabase: ReturnType<typeof db>, phone: string, messages: WaMessage[]) {
  await supabase.from('wa_sessions').upsert(
    { phone, messages, updated_at: new Date().toISOString() },
    { onConflict: 'phone' },
  )
}

async function deleteSession(supabase: ReturnType<typeof db>, phone: string) {
  await supabase.from('wa_sessions').delete().eq('phone', phone)
  // Aproveita para limpar sessões antigas (> 48h) — evita acúmulo no banco
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  void supabase.from('wa_sessions').delete().lt('updated_at', cutoff)
    .then(() => {}, () => {})
}

/* ─── Normaliza telefone → apenas dígitos ─────────────────── */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Compara dois telefones ignorando formatação e código de país.
 * "5511999990000" bate com "11999990000" e com "(11) 99999-0000".
 */
function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhone(a)
  const db_ = normalizePhone(b)
  // Remove o prefixo 55 se presente e compara os últimos 11 dígitos (DDD + número)
  const trim = (d: string) => d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
  return trim(da) === trim(db_)
}

/* ─── Envia mensagem de texto via Z-API ───────────────────── */
async function sendMessage(phone: string, message: string): Promise<void> {
  const { instance, token, clientToken } = getZApiCreds()

  console.log(`[whatsapp] sendMessage → instance="${instance}" token="${token ? token.slice(0,6) + '…' : ''}" clientToken="${clientToken ? clientToken.slice(0,6) + '…' : '(vazio)'}" phone="${phone}"`)

  if (!instance || !token) {
    console.error('[whatsapp] ✗ ZAPI_INSTANCE ou ZAPI_TOKEN ausentes — abortando envio')
    return
  }

  const url  = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken
  const body = JSON.stringify({ phone, message })

  console.log(`[whatsapp] Z-API POST ${url} | Client-Token: ${clientToken ? 'presente' : 'ausente'}`)
  console.log(`[whatsapp] Z-API body: ${body.slice(0, 300)}`)

  try {
    const res     = await fetch(url, { method: 'POST', headers, body })
    const resText = await res.text()
    console.log(`[whatsapp] Z-API response: status=${res.status} body=${resText}`)

    if (!res.ok) {
      console.error(`[whatsapp] ✗ Z-API erro HTTP ${res.status}: ${resText}`)
    } else {
      console.log(`[whatsapp] ✓ mensagem enviada com sucesso para ${phone}`)
    }
  } catch (e) {
    console.error('[whatsapp] ✗ fetch exception ao chamar Z-API:', e)
  }
}

/* ─── Formata número para exibição ───────────────────────── */
function fmtPhone(phone: string): string {
  const d = normalizePhone(phone)
  const local = d.startsWith('55') ? d.slice(2) : d
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`
  return phone
}

/* ═══════════════════════════════════════════════════════════ */
/*  Handler                                                    */
/* ═══════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const ts = new Date().toISOString()

  /* ── Verificação de assinatura Z-API ─────────────────────────
     Se ZAPI_CLIENT_TOKEN estiver configurado, exige que o header
     'client-token' da requisição seja idêntico.
     Isso impede spoofing do webhook por atacantes externos.     */
  const zapiClientToken = (process.env.ZAPI_CLIENT_TOKEN ?? '').trim()
  if (zapiClientToken) {
    const incoming = (req.headers.get('client-token') ?? '').trim()
    if (incoming !== zapiClientToken) {
      console.warn(`[whatsapp] ✗ client-token inválido: "${incoming.slice(0, 10)}…" — rejeitado`)
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    console.log('[whatsapp] ✓ client-token verificado')
  }

  /* ── Log bruto da requisição ─────────────────────────────── */
  let rawBody = ''
  let payload: ZApiPayload
  try {
    rawBody = await req.text()
    console.log(`[whatsapp] ▶ POST recebido ${ts} (${rawBody.length}b)`)
    payload = JSON.parse(rawBody)
  } catch (e) {
    console.error(`[whatsapp] ✗ JSON inválido:`, e)
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  console.log(`[whatsapp] phone=${payload.phone} type=${payload.type} fromMe=${payload.fromMe} isStatus=${payload.isStatusReply} broadcast=${payload.broadcast}`)

  /* ── Ignora mensagens enviadas por nós, status, broadcasts ── */
  if (payload.fromMe || payload.isStatusReply || payload.broadcast) {
    console.log(`[whatsapp] ⏭ skipped: fromMe/status/broadcast`)
    return NextResponse.json({ ok: true, skipped: 'self-or-broadcast' })
  }
  if (payload.type !== 'ReceivedCallback') {
    console.log(`[whatsapp] ⏭ skipped: type=${payload.type} (not ReceivedCallback)`)
    return NextResponse.json({ ok: true, skipped: `type:${payload.type}` })
  }

  /* ── Extrai texto da mensagem ────────────────────────────── */
  const text = payload.text?.message?.trim() ?? ''
  if (!text) {
    console.log(`[whatsapp] ⏭ skipped: sem texto (mídia ou vazio)`)
    return NextResponse.json({ ok: true, skipped: 'no-text' })
  }

  const phone = payload.phone
  console.log(`[whatsapp] ✉ mensagem de ${fmtPhone(phone)}: "${text.slice(0, 80)}"`)

  /* ── Busca perfil por telefone ───────────────────────────── */
  const supabase = db()
  const { data: profiles, error: dbErr } = await supabase
    .from('profiles')
    .select('id, full_name, city, skills, score, phone')
    .not('phone', 'is', null)

  if (dbErr) console.error(`[whatsapp] ✗ Supabase error:`, dbErr)

  const profile = (profiles ?? []).find(p => phonesMatch(p.phone ?? '', phone))
  console.log(`[whatsapp] perfil: ${profile ? `encontrado id=${profile.id} nome=${profile.full_name}` : 'não encontrado'}`)

  /* ══════════════════════════════════════════════════════════
     CASO 1 — Número NÃO cadastrado → onboarding com Claude
  ══════════════════════════════════════════════════════════ */
  if (!profile) {
    console.log(`[whatsapp] → caso: onboarding`)

    /* Recupera ou cria sessão de conversa */
    const history = await getSession(supabase, phone)
    const messages: WaMessage[] = [...history, { role: 'user', content: text }]

    console.log(`[whatsapp] onboarding: ${messages.length} msg(s) no histórico`)

    /* Chama Claude */
    const result = await runOnboarding(messages)
    console.log(`[whatsapp] onboarding: finished=${result.finished} reply="${result.reply.slice(0, 60)}"`)

    if (result.finished && result.profile) {
      /* Salva perfil no Supabase */
      const savedId = await saveOnboardingProfile(supabase, phone, result.profile)
      console.log(`[whatsapp] onboarding: perfil salvo id=${savedId} nome=${result.profile.nome}`)

      /* Limpa sessão */
      await deleteSession(supabase, phone)

      /* Mensagem de confirmação */
      const confirmMsg =
        `✅ *Perfil criado na Bikco!*\n\n` +
        `👤 *${result.profile.nome}*\n` +
        `🔧 ${result.profile.skills.join(', ')}\n` +
        `📍 ${result.profile.cidade}\n\n` +
        `Agora você vai receber notificações de bicos na sua região. 🟡\n` +
        `Acesse *bikco.com* para completar seu perfil com foto e portfólio.`

      await sendMessage(phone, confirmMsg)
    } else {
      /* Salva sessão atualizada com a resposta do Claude */
      const updatedMessages: WaMessage[] = [
        ...messages,
        { role: 'assistant', content: result.reply },
      ]
      await saveSession(supabase, phone, updatedMessages)

      /* Envia próxima pergunta */
      await sendMessage(phone, result.reply)
    }

    return NextResponse.json({ ok: true, case: 'onboarding', finished: result.finished })
  }

  const isProfessional = !!(profile.skills && (profile.skills as string[]).length > 0)
  console.log(`[whatsapp] → isProfessional=${isProfessional}`)

  /* ══════════════════════════════════════════════════════════
     CASO 2 — Profissional cadastrado
  ══════════════════════════════════════════════════════════ */
  if (isProfessional) {
    console.log(`[whatsapp] → caso: professional`)
    // Sanitiza cidade: apenas letras, espaços, hífens e acentos (máx 80 chars)
    const rawCidade   = (profile.city ?? '').trim()
    const cidadeSafe  = rawCidade.replace(/[^a-zA-ZÀ-ÿ\s\-]/g, '').trim().slice(0, 80)

    // Se cidade inválida/vazia, busca pedidos recentes sem filtro de cidade
    const pedidosQuery = supabase
      .from('posts')
      .select('id, descricao, cidade, created_at')
      .order('created_at', { ascending: false })
      .limit(3)

    const { data: pedidos } = cidadeSafe.length >= 2
      ? await pedidosQuery.ilike('cidade', `%${cidadeSafe}%`)
      : await pedidosQuery

    const cidade = cidadeSafe || 'sua região'

    console.log(`[whatsapp] pedidos na cidade "${cidade}": ${pedidos?.length ?? 0}`)

    let msg = `Oi, *${profile.full_name}*! 👷\n\n`

    if (pedidos && pedidos.length > 0) {
      msg += `Aqui estão os últimos pedidos da sua região *${cidade}*:\n\n`
      pedidos.forEach((p, i) => {
        const data = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        msg += `${i + 1}. 📋 ${p.descricao ?? 'Pedido de serviço'} — ${data}\n`
      })
      msg += `\n👉 Acesse *bikco.com* para ver todos os detalhes e responder.`
    } else {
      msg +=
        `Ainda não há pedidos novos na sua região *${cidade}* agora.\n\n` +
        `Assim que aparecer um, te aviso! 🔔\n\n` +
        `_Enquanto isso, mantenha seu perfil atualizado em bikco.com_`
    }

    await sendMessage(phone, msg)
    return NextResponse.json({ ok: true, case: 'professional' })
  }

  /* ══════════════════════════════════════════════════════════
     CASO 3 — Cliente cadastrado
  ══════════════════════════════════════════════════════════ */
  console.log(`[whatsapp] → caso: client`)

  const { data: meusPedidos } = await supabase
    .from('posts')
    .select('id, descricao, created_at, status')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const ultimoPedido = meusPedidos?.[0]

  let msg = `Oi, *${profile.full_name}*! 👋\n\n`

  if (ultimoPedido) {
    const data = new Date(ultimoPedido.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
    const status = ultimoPedido.status ?? 'em aberto'
    msg +=
      `✅ Seu pedido foi recebido!\n\n` +
      `📋 *${ultimoPedido.descricao ?? 'Pedido de serviço'}*\n` +
      `📅 Postado em: ${data}\n` +
      `📌 Status: _${status}_\n\n` +
      `Assim que um profissional aceitar, te aviso aqui mesmo! 🦆`
  } else {
    msg +=
      `Você ainda não tem pedidos ativos.\n\n` +
      `Para contratar um profissional, acesse *bikco.com* e descreva o que você precisa — é grátis! 🔍`
  }

  await sendMessage(phone, msg)
  return NextResponse.json({ ok: true, case: 'client' })
}

/* ── GET para verificação de webhook ────────────────────── */
export async function GET() {
  console.log(`[whatsapp] ▶ GET health-check ${new Date().toISOString()}`)
  return NextResponse.json({ ok: true, service: 'bikco-whatsapp-webhook' })
}
