import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs' // ensure access to process.env (server-side only)

const SYSTEM_PROMPT = `Você é o assistente da Bikco, um marketplace brasileiro de serviços ("bicos").
O usuário está descrevendo um serviço que precisa contratar. Transforme o pedido dele numa descrição
CLARA, COMPLETA e específica, que faça um profissional entender na hora e querer responder rápido.

Como melhorar:
- Deixe o serviço explícito e específico: o que precisa, onde (qual cômodo/parte) e o problema ou objetivo.
- Use o que a pessoa disse, no tom dela, mas organize e complete o que está implícito — SEM inventar
  fatos que ela não deu (datas, preços, endereços, marcas, medidas exatas, nomes, quantidades).
- ONDE um número, quantidade, medida, área ou data ajudaria o profissional a orçar mas a pessoa NÃO
  informou, escreva a letra "X" como espaço reservado para ela mesma preencher depois. Exemplos:
  "casa com X cômodos, sendo X quartos e X banheiros", "mudança de um apartamento de X cômodos",
  "pintura de aproximadamente X m²", "evento para X convidados no dia X". Use "X" só quando o dado
  realmente faria diferença no orçamento — não encha o texto de X.
- 2 a 4 frases. Natural e direto, em português do Brasil.
- Sem saudações, sem aspas, sem listas com marcadores, sem emojis.

Formato OBRIGATÓRIO da resposta (exatamente assim):
TÍTULO: <um título curto e chamativo, no máximo 7 palavras, que resume o pedido — ex.: "Diarista para faxina completa", "Professor particular de inglês">
<linha em branco>
<a descrição reescrita, 2 a 4 frases>

Não escreva mais nada além disso.`

const MIN_CHARS = 6
const MAX_CHARS = 600

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text.trim() : ''
}

export async function POST(req: NextRequest) {
  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  if (text.length < MIN_CHARS) {
    return NextResponse.json({ ok: false, error: 'texto_curto' }, { status: 400 })
  }
  const input = text.slice(0, MAX_CHARS)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[refine-demand] ANTHROPIC_API_KEY ausente no ambiente')
    return NextResponse.json({ ok: false, error: 'sem_api_key' }, { status: 500 })
  }
  const claude = new Anthropic({ apiKey })

  try {
    const response = await claude.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: input }],
    })

    const raw = textOf(response.content)
    if (!raw) {
      return NextResponse.json({ ok: false, error: 'sem_resposta' }, { status: 502 })
    }

    // Separa "TÍTULO: ..." (1ª linha) da descrição.
    let title = ''
    let refined = raw
    const m = raw.match(/^\s*T[ÍI]TULO:\s*(.+?)(?:\n|$)/i)
    if (m) {
      title   = m[1].trim().replace(/^["']|["']$/g, '').slice(0, 80)
      refined = raw.slice(m[0].length).trim()
    }
    if (!refined) refined = raw  // fallback se o modelo não separou

    return NextResponse.json({ ok: true, refined, title })
  } catch (e) {
    console.error('[refine-demand] Claude error:', e)
    return NextResponse.json({ ok: false, error: 'claude_error' }, { status: 502 })
  }
}
