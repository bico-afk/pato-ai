import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chat_id, candidatura_id } = body

    if (!chat_id && !candidatura_id) {
      return NextResponse.json({ error: 'chat_id ou candidatura_id obrigatório' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    )

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    /* ── Resolve IDs from chat_id ── */
    let resolvedCandId: string | null = candidatura_id ?? null
    let resolvedPostId: string | null = null
    let resolvedContratanteId: string | null = null
    let resolvedPrestadorId: string | null = null
    let chatIdResolved: string | null = chat_id ?? null

    if (chat_id) {
      // Try 'chats' table first
      let chatRow: Record<string, string> | null = null
      const { data: c1 } = await supabase.from('chats').select('*').eq('id', chat_id).single()
      if (c1) {
        chatRow = c1 as Record<string, string>
      } else {
        const { data: c2 } = await supabase.from('conversas').select('*').eq('id', chat_id).single()
        if (c2) chatRow = c2 as Record<string, string>
      }
      if (!chatRow) return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 })

      resolvedPostId       = chatRow.post_id
      resolvedContratanteId = chatRow.contratante_id
      resolvedPrestadorId  = chatRow.prestador_id
      resolvedCandId       = chatRow.candidatura_id ?? null
    }

    /* ── Load post ── */
    let post: Record<string, unknown> = {}
    if (resolvedPostId) {
      const { data: p } = await supabase.from('posts')
        .select('id, title, description, category, city, state, budget_min, budget_max, urgency, user_id')
        .eq('id', resolvedPostId).single()
      if (p) {
        post = p as Record<string, unknown>
        if (!resolvedContratanteId) resolvedContratanteId = p.user_id as string
      }
    }

    /* ── Load candidatura (if available) ── */
    let candValor: number | null = null
    let candProposta: string | null = null
    let candTipo: string | null = null
    let candDisponibilidade: string | null = null

    if (resolvedCandId) {
      const { data: cand } = await supabase.from('candidaturas')
        .select('valor, proposta, mensagem, tipo, disponibilidade, prestador_id')
        .eq('id', resolvedCandId).single()
      if (cand) {
        candValor          = cand.valor
        candProposta       = cand.mensagem || cand.proposta
        candTipo           = cand.tipo
        candDisponibilidade = cand.disponibilidade
        if (!resolvedPrestadorId) resolvedPrestadorId = cand.prestador_id
      }
    } else if (!resolvedCandId && resolvedPrestadorId && resolvedPostId) {
      // Try to find candidatura from post + prestador
      const { data: cand } = await supabase.from('candidaturas')
        .select('id, valor, proposta, mensagem, tipo, disponibilidade')
        .eq('post_id', resolvedPostId)
        .eq('prestador_id', resolvedPrestadorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cand) {
        resolvedCandId     = cand.id
        candValor          = cand.valor
        candProposta       = cand.mensagem || cand.proposta
        candTipo           = cand.tipo
        candDisponibilidade = cand.disponibilidade
      }
    }

    /* ── Load profiles ── */
    const [{ data: contratanteProf }, { data: prestadorProf }] = await Promise.all([
      resolvedContratanteId
        ? supabase.from('profiles').select('id, full_name, city, state, bio').eq('id', resolvedContratanteId).single()
        : Promise.resolve({ data: null }),
      resolvedPrestadorId
        ? supabase.from('profiles').select('id, full_name, city, state, bio').eq('id', resolvedPrestadorId).single()
        : Promise.resolve({ data: null }),
    ])

    /* ── Fetch last chat messages for context ── */
    let mensagensTexto = ''
    if (chatIdResolved) {
      for (const field of ['chat_id', 'conversa_id']) {
        const { data: msgs } = await supabase.from('mensagens')
          .select('sender_id, remetente_id, content, created_at')
          .eq(field, chatIdResolved)
          .order('created_at', { ascending: false })
          .limit(20)
        if (msgs?.length) {
          mensagensTexto = '\n\nMENSAGENS DO CHAT:\n' + [...msgs].reverse().map(m => {
            const sid  = m.sender_id || m.remetente_id
            const quem = sid === resolvedContratanteId
              ? `${(contratanteProf as Record<string, string>)?.full_name || 'Contratante'} (contratante)`
              : `${(prestadorProf as Record<string, string>)?.full_name || 'Prestador'} (prestador)`
            return `${quem}: ${m.content}`
          }).join('\n')
          break
        }
      }
    }

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const tipoLabel: Record<string, string> = { fixo: 'Valor fixo', hora: 'Por hora', visita: 'Visita técnica' }
    const urgLabel: Record<string, string>  = { hoje: 'Urgente – hoje', semana: 'Esta semana', sem_pressa: 'Sem pressa definida' }

    /* ── Build prompt ── */
    const prompt = `Você é um assistente jurídico especializado em contratos de prestação de serviços no Brasil.
Gere um contrato de prestação de serviços completo, claro e juridicamente válido.

DADOS DO SERVIÇO:
- Serviço: ${(post.title as string) || 'Serviço não especificado'}
- Descrição: ${(post.description as string) || 'Não informada'}
- Categoria: ${(post.category as string) || 'Geral'}
- Localidade: ${[(post.city as string), (post.state as string)].filter(Boolean).join(', ') || 'Não informada'}
- Orçamento previsto: ${post.budget_min ? `R$ ${post.budget_min}` : ''} ${post.budget_max ? `– R$ ${post.budget_max}` : ''}
- Urgência: ${urgLabel[(post.urgency as string)] || 'Não especificada'}

CONTRATANTE (quem precisa do serviço):
- Nome: ${(contratanteProf as Record<string, string>)?.full_name || 'Não informado'}
- CPF: [CPF DO CONTRATANTE]
- Endereço: ${[(contratanteProf as Record<string, string>)?.city, (contratanteProf as Record<string, string>)?.state].filter(Boolean).join(', ') || 'Não informado'}

PRESTADOR DE SERVIÇOS (quem executa o serviço):
- Nome: ${(prestadorProf as Record<string, string>)?.full_name || 'Não informado'}
- CPF: [CPF DO PRESTADOR]
- Endereço: ${[(prestadorProf as Record<string, string>)?.city, (prestadorProf as Record<string, string>)?.state].filter(Boolean).join(', ') || 'Não informado'}

PROPOSTA ACEITA:
- Valor: ${candValor ? `R$ ${candValor}` : 'A combinar'}
- Tipo de cobrança: ${tipoLabel[candTipo || ''] || 'Valor fixo'}
- Disponibilidade/Prazo: ${candDisponibilidade || 'A combinar'}
- Detalhes: ${candProposta || 'Não especificada'}
${mensagensTexto}

Data de hoje: ${today}

INSTRUÇÕES PARA O CONTRATO:
Gere um contrato com EXATAMENTE as 8 seções abaixo, nesta ordem, com títulos em MAIÚSCULAS:

1. IDENTIFICAÇÃO DAS PARTES
2. DESCRIÇÃO DO SERVIÇO
3. VALOR E FORMA DE PAGAMENTO
4. PRAZO DE EXECUÇÃO
5. OBRIGAÇÕES DO CONTRATANTE
6. OBRIGAÇÕES DO PRESTADOR
7. CONDIÇÕES DE CANCELAMENTO
8. FORO

Regras:
- Linguagem clara e acessível, mas juridicamente correta
- Adequado para serviços autônomos/informais no Brasil
- Deixe CPF como "[CPF DO CONTRATANTE]" e "[CPF DO PRESTADOR]"
- Cada seção com parágrafos numerados (ex: 1.1, 1.2...)
- Finalize com espaço para data e assinaturas digitais
- Tom profissional mas humano`

    /* ── Call Claude ── */
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const conteudo = (message.content[0] as { text: string }).text

    /* ── Save to contratos ── */
    const insertPayload: Record<string, unknown> = {
      conteudo,
      status: 'pendente',
      contratante_id: resolvedContratanteId,
      prestador_id:   resolvedPrestadorId,
    }
    if (resolvedPostId)  insertPayload.post_id        = resolvedPostId
    if (resolvedCandId)  insertPayload.candidatura_id = resolvedCandId

    // Try with chat_id first, fallback without
    let saved: { id: string } | null = null
    const payloadWithChat = { ...insertPayload, chat_id: chatIdResolved }
    const { data: s1, error: e1 } = await supabase.from('contratos').insert(payloadWithChat).select('id').single()
    if (!e1 && s1) {
      saved = s1
    } else {
      const { data: s2, error: e2 } = await supabase.from('contratos').insert(insertPayload).select('id').single()
      if (!e2 && s2) saved = s2
    }

    if (!saved) {
      // Still return contract text even if save failed
      return NextResponse.json({ conteudo, id: null })
    }

    /* ── Notify prestador ── */
    if (resolvedPrestadorId) {
      await supabase.from('notificacoes').insert({
        user_id: resolvedPrestadorId,
        tipo: 'contrato_gerado',
        titulo: '📄 Contrato aguardando assinatura',
        mensagem: `${(contratanteProf as Record<string, string>)?.full_name || 'O contratante'} gerou um contrato para "${(post.title as string) || 'o serviço'}". Acesse para assinar.`,
        link: `/contrato/${chatIdResolved || saved.id}`,
        lida: false,
      }).then(() => {})
    }

    return NextResponse.json({ conteudo, id: saved.id })

  } catch (err: unknown) {
    console.error('Erro ao gerar contrato:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
