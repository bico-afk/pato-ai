import { NextRequest, NextResponse }    from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { getAuthUser, unauthorized }      from '@/lib/auth'

async function sendWA(phone: string, message: string) {
  const instance    = (process.env.ZAPI_INSTANCE     ?? '').trim()
  const token       = (process.env.ZAPI_TOKEN        ?? '').trim()
  const clientToken = (process.env.ZAPI_CLIENT_TOKEN ?? '').trim()
  if (!instance || !token) return
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken
  await fetch(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    { method: 'POST', headers, body: JSON.stringify({ phone, message }) },
  ).catch(e => console.error('[close-bico] WA notify error:', e))
}

export async function POST(req: NextRequest) {
  /* ── 1. Autenticação — userId vem da sessão, NUNCA do body ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const userId = user.id

  /* ── 2. Parse body — userId removido intencionalmente ── */
  let body: { postId?: string; conversaId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }) }

  const { postId, conversaId } = body

  if (!postId) {
    return NextResponse.json({ ok: false, error: 'postId é obrigatório' }, { status: 400 })
  }

  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  /* ── 3. Busca post ── */
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id, status')
    .eq('id', postId)
    .single()

  if (postErr || !post) {
    return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
  }

  /* ── 4. Verifica autorização: dono do post OU participante da conversa ── */
  let authorized = post.user_id === userId

  if (!authorized && conversaId) {
    const { data: conv } = await supabase
      .from('conversas')
      .select('user1_id, user2_id')
      .eq('id', conversaId)
      .single()
    if (conv) {
      authorized = conv.user1_id === userId || conv.user2_id === userId
    }
  }

  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 403 })
  }

  /* ── 5. Atualiza status do post ── */
  const { error: updateErr } = await supabase
    .from('posts')
    .update({ status: 'concluido' })
    .eq('id', postId)

  if (updateErr) {
    console.error('[close-bico] update error:', updateErr.message)
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
  }

  /* ── 6. Mensagem de sistema na conversa (se fornecida) ── */
  if (conversaId) {
    await supabase.from('mensagens').insert({
      conversa_id: conversaId,
      sender_id:   userId,
      content:     '🎉 Bico concluído! Obrigado pela parceria.',
      type:        'system',
    })

    /* ── 7. Notifica o outro participante via WhatsApp ── */
    const { data: conv } = await supabase
      .from('conversas')
      .select('user1_id, user2_id')
      .eq('id', conversaId)
      .single()

    if (conv) {
      const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', otherId)
        .maybeSingle()

      if (otherProfile?.phone) {
        await sendWA(
          otherProfile.phone as string,
          `✅ O bico foi concluído!\n\nAcesse *bikco.com* para ver os detalhes da conversa.`,
        )
      }
    }
  }

  console.log('[close-bico] ✓ post', postId, 'concluído por user', userId)
  return NextResponse.json({ ok: true })
}
