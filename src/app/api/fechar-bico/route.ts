import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { candidatura_id } = await req.json()
    if (!candidatura_id) return NextResponse.json({ error: 'candidatura_id obrigatório' }, { status: 400 })

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const dbClient = serviceKey
      ? createClient(url, serviceKey)
      : createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })

    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    const { data: { user } } = await authClient.auth.getUser()
    const uid = user?.id
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Buscar candidatura com detalhes da proposta
    const { data: cand, error: cErr } = await dbClient
      .from('candidaturas')
      .select('id, post_id, prestador_id, status, proposta, valor, tipo_cobranca')
      .eq('id', candidatura_id)
      .single()

    if (cErr || !cand) {
      console.error('Erro ao buscar candidatura:', cErr)
      return NextResponse.json({ error: 'Candidatura não encontrada' }, { status: 404 })
    }

    // 1. Confirmar candidatura → status = 'confirmada'
    const { error: candErr } = await dbClient
      .from('candidaturas')
      .update({ status: 'confirmada' })
      .eq('id', candidatura_id)

    if (candErr) {
      console.error('Erro ao confirmar candidatura:', candErr)
      return NextResponse.json({ error: 'Falha ao confirmar candidatura: ' + candErr.message }, { status: 500 })
    }

    // 2. Fechar o post → status = 'fechado'
    await dbClient.from('posts').update({ status: 'fechado' }).eq('id', cand.post_id)

    // 3. Recusar outras candidaturas pendentes do mesmo post
    await dbClient
      .from('candidaturas')
      .update({ status: 'recusada' })
      .eq('post_id', cand.post_id)
      .neq('id', candidatura_id)
      .in('status', ['pendente', 'aceita'])

    // 4. Buscar dados para o resumo
    const [{ data: thePost }, { data: contratante }, { data: prestador }] = await Promise.all([
      dbClient.from('posts').select('title, category, city').eq('id', cand.post_id).single(),
      dbClient.from('profiles').select('full_name').eq('id', uid).single(),
      dbClient.from('profiles').select('full_name').eq('id', cand.prestador_id).single(),
    ])

    // 5. Criar/buscar conversa entre contratante e prestador
    const { data: conversa, error: convErr } = await dbClient
      .from('conversas')
      .upsert(
        { post_id: cand.post_id, contratante_id: uid, prestador_id: cand.prestador_id },
        { onConflict: 'post_id,prestador_id' }
      )
      .select('id')
      .single()

    if (convErr) console.error('Erro ao criar conversa:', convErr)

    // 6. Inserir mensagem automática de resumo no chat
    if (conversa?.id) {
      const tipoLabel: Record<string, string> = {
        fixo:   '💰 Valor fixo',
        hora:   '⏱️ Por hora',
        visita: '🔍 Visita técnica',
      }
      const tipo = cand.tipo_cobranca ? tipoLabel[cand.tipo_cobranca] ?? cand.tipo_cobranca : null

      const linhas: string[] = [
        '🦆 *Bico fechado! Aqui está o resumo do combinado:*',
        '',
        `📋 Serviço: ${thePost?.title ?? '—'}`,
      ]
      if (thePost?.category) linhas.push(`🏷️ Categoria: ${thePost.category}`)
      if (thePost?.city)     linhas.push(`📍 Local: ${thePost.city}`)
      if (tipo)              linhas.push(`💼 Cobrança: ${tipo}`)
      if (cand.valor)        linhas.push(`💵 Valor: R$ ${cand.valor}`)
      if (cand.proposta)     linhas.push(`📝 Proposta: "${cand.proposta}"`)
      linhas.push('')
      linhas.push(`✅ Contratante: ${contratante?.full_name ?? '—'}`)
      linhas.push(`🔧 Prestador: ${prestador?.full_name ?? '—'}`)
      linhas.push('')
      linhas.push('Bom trabalho para os dois! 🎉')

      await dbClient.from('mensagens').insert({
        conversa_id: conversa.id,
        remetente_id: uid, // enviada pelo contratante (sistema)
        content: linhas.join('\n'),
        lida: false,
      })
    }

    // 7. Notificar o prestador
    await dbClient.from('notificacoes').insert({
      user_id: cand.prestador_id,
      tipo: 'proposta_aceita',
      titulo: '🎉 Você foi contratado!',
      mensagem: `${contratante?.full_name || 'O contratante'} aceitou sua proposta para "${thePost?.title}". Acesse o chat!`,
      link: conversa?.id ? `/chat/${conversa.id}` : `/bico/${cand.post_id}`,
    })

    return NextResponse.json({
      ok: true,
      post_id: cand.post_id,
      conversa_id: conversa?.id ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('fechar-bico error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
