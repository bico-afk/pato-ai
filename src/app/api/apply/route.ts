import { NextRequest, NextResponse }     from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { getAuthUser, unauthorized }      from '@/lib/auth'

function getZApiCreds() {
  return {
    instance:    process.env.ZAPI_INSTANCE    ?? '',
    token:       process.env.ZAPI_TOKEN       ?? '',
    clientToken: process.env.ZAPI_CLIENT_TOKEN ?? '',
  }
}

async function sendWAMessage(phone: string, message: string) {
  const { instance, token, clientToken } = getZApiCreds()
  if (!instance || !token) {
    console.log('[apply] Z-API creds missing, skipping WA notify')
    return
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken
  try {
    const res  = await fetch(
      `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
      { method: 'POST', headers, body: JSON.stringify({ phone, message }) },
    )
    const body = await res.json()
    console.log('[apply] WA notify status:', res.status, JSON.stringify(body))
  } catch (e) {
    console.error('[apply] WA notify error:', e)
  }
}

export async function POST(req: NextRequest) {
  /* ── 1. Autenticação ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const professionalId = user.id   // ID vem da sessão, não do body

  /* ── 2. Parse body ── */
  let body: { postId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }) }

  const { postId } = body
  if (!postId) {
    return NextResponse.json({ ok: false, error: 'postId é obrigatório' }, { status: 400 })
  }

  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  /* ── 3. Busca post + dono ── */
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, title, user_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) {
    console.error('[apply] post not found:', postErr?.message)
    return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
  }

  const ownerId = post.user_id as string

  if (ownerId === professionalId) {
    return NextResponse.json(
      { ok: false, error: 'Você não pode se candidatar ao próprio pedido' },
      { status: 400 },
    )
  }

  /* ── 4. Encontra ou cria conversa ── */
  let conversaId: string
  let isNew = false

  const { data: existing } = await supabase
    .from('conversas')
    .select('id')
    .eq('post_id', postId)
    .eq('user1_id', professionalId)
    .maybeSingle()

  if (existing) {
    conversaId = existing.id
    console.log('[apply] existing conversa:', conversaId)
  } else {
    const { data: created, error: createErr } = await supabase
      .from('conversas')
      .insert({ post_id: postId, user1_id: professionalId, user2_id: ownerId, status: 'ativa' })
      .select('id')
      .single()

    if (createErr || !created) {
      console.error('[apply] create conversa error:', createErr?.message)
      return NextResponse.json({ ok: false, error: 'Erro ao criar conversa' }, { status: 500 })
    }
    conversaId = created.id
    isNew = true
    console.log('[apply] new conversa:', conversaId)
  }

  /* ── 5. Mensagem automática + notificação (só em conversas novas) ── */
  if (isNew) {
    await supabase.from('mensagens').insert({
      conversa_id: conversaId,
      sender_id:   professionalId,
      content:     'Olá! Vi seu pedido e posso te ajudar. Vamos conversar?',
      type:        'text',
    })

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', ownerId)
      .maybeSingle()

    if (ownerProfile?.phone) {
      const title = (post.title as string).slice(0, 60)
      const msg   = `🟡 Alguém se candidatou ao seu pedido!\n\n"${title}"\n\nAcesse bikco.com para conversar com o candidato.`
      await sendWAMessage(ownerProfile.phone as string, msg)
    }
  }

  return NextResponse.json({ ok: true, conversaId, isNew })
}
