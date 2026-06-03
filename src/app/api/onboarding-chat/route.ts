import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

/* AI onboarding chat — the person describes what they do; Claude has a natural
   conversation and assembles a professional profile. Key stays server-side. */

const SYSTEM_PROMPT = `Você é o assistente da Bikco, uma plataforma brasileira de serviços ("bicos").
Você está conversando com alguém que quer OFERECER seus serviços e montar um perfil de profissional.

Seu objetivo, através de uma conversa natural e acolhedora, é descobrir:
- O nome da pessoa
- O que ela sabe fazer (serviços / habilidades principais)
- A experiência dela: o que já fez, há quanto tempo trabalha com isso, exemplos
- A cidade (e o estado) onde ela atende
- O WhatsApp dela (com DDD) — pergunte por último, explicando que é por onde os clientes vão chamá-la

Estilo:
- Converse de forma calorosa e humana, como um colega ajudando. UMA pergunta por vez, curtas.
- Faça perguntas de acompanhamento sobre a experiência ("legal! há quanto tempo você faz isso?",
  "que tipo de trabalho você mais pega?") para montar um perfil rico — mas seja breve.
- Não seja robótico nem peça tudo de uma vez. No máximo ~5 a 6 trocas.
- Português do Brasil, natural. Sem listas longas, sem emojis em excesso.

Quando já tiver nome + pelo menos 1 habilidade + cidade + uma noção da experiência + o WhatsApp, FINALIZE
retornando EXATAMENTE este bloco e NADA MAIS:
<PROFILE>
{
  "nome": "...",
  "headline": "título curto, ex: 'Eletricista residencial • 8 anos de experiência'",
  "skills": ["habilidade1", "habilidade2"],
  "cidade": "...",
  "estado": "UF",
  "whatsapp": "número com DDD, só dígitos, ex: 11999998888",
  "bio": "2 a 3 frases descrevendo a experiência da pessoa, em terceira pessoa, para o perfil público"
}
</PROFILE>

NUNCA invente dados que a pessoa não disse. Se ainda faltar algo, faça apenas a próxima pergunta em texto simples.`

interface Msg { role: 'user' | 'assistant'; content: string }

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  const b = content.find(x => x.type === 'text')
  return b && b.type === 'text' ? b.text : ''
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'sem_api_key' }, { status: 500 })

  let messages: Msg[] = []
  try {
    const body = await req.json()
    messages = (body.messages ?? []).filter((m: Msg) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  if (!messages.length) {
    return NextResponse.json({ ok: false, error: 'sem_mensagens' }, { status: 400 })
  }

  try {
    const claude = new Anthropic({ apiKey })
    const res = await claude.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const raw = textOf(res.content)
    const match = raw.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
    if (match) {
      try {
        const profile = JSON.parse(match[1].trim())
        const reply = raw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>/, '').trim()
        return NextResponse.json({ ok: true, finished: true, profile, reply })
      } catch {
        return NextResponse.json({ ok: true, finished: false, reply: 'Quase lá! Pode me confirmar seu nome, o que você faz e em qual cidade?' })
      }
    }
    return NextResponse.json({ ok: true, finished: false, reply: raw })
  } catch (e) {
    console.error('[onboarding-chat] error:', e)
    return NextResponse.json({ ok: false, error: 'claude_error' }, { status: 502 })
  }
}
