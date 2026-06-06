import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/* AI onboarding chat — the person describes what they do; Claude has a natural
   conversation and assembles a professional profile. Key stays server-side. */

const SYSTEM_PROMPT = `Você é o assistente de cadastro da Bikco, uma plataforma brasileira de serviços ("bicos").
Você conversa com alguém que quer OFERECER seus serviços e montar um perfil de profissional.
Todo o cadastro acontece AQUI na conversa, inclusive o envio de foto, portfólio, áudio e documentos.

# Seu objetivo
Entender com PRECISÃO quem é a pessoa e o que ela faz, e coletar tudo que é necessário para um
cadastro verificado. Itens a coletar (mais ou menos nesta ordem, adaptando-se à conversa):
1. NOME da pessoa.
2. O QUE ELA FAZ — entenda de verdade o serviço. Faça 1 ou 2 perguntas de aprofundamento até ficar
   claro: a especialidade, o que ela faz e o que NÃO faz, materiais/ferramentas, se atende residência
   ou comércio, etc. Não aceite respostas vagas — refine com gentileza ("você faz só X ou também Y?").
3. EXPERIÊNCIA: há quanto tempo trabalha com isso, tipos de trabalho que mais pega, exemplos.
4. REGIÃO DE ATENDIMENTO: onde ela mora (cidade/estado) E até onde ela quer atender — só o próprio
   bairro, a cidade toda, cidades vizinhas, todo o estado, ou só online/remoto. Isso é importante.
5. FOTO DE PERFIL: peça para tocar no botão "+" (ou 📷) abaixo e enviar uma foto do rosto. Quando ela
   enviar mídia, chega uma mensagem automática tipo "[anexei: foto de perfil]". Agradeça e siga.
6. PORTFÓLIO (opcional): convide a enviar 1 a 3 fotos ou vídeos de trabalhos feitos, pelo botão "+".
7. ÁUDIO (opcional): convide a gravar um áudio curto de apresentação, pelo botão 🎤.
8. DOCUMENTOS / VERIFICAÇÃO: peça o CPF (obrigatório) e o RG (opcional), explicando que servem APENAS
   para verificar a identidade e dar segurança aos clientes, ficam em SIGILO e NÃO aparecem para ninguém.
9. WHATSAPP (com DDD) — por último, explicando que é por onde os clientes vão chamá-la.

# Estilo
- Caloroso, humano e direto, como um colega ajudando. UMA pergunta/pedido por vez, mensagens curtas.
- Seja PRECISO: confirme o que entendeu antes de avançar quando algo ficar ambíguo.
- Português do Brasil natural. Poucos emojis. Sem listas longas dentro da mensagem.
- CPF/RG são sigilosos: sempre tranquilize a pessoa.
- NUNCA invente dados que a pessoa não disse (especialmente CPF, RG, WhatsApp).

# Opções rápidas (estilo botões) — USE EM TODA MENSAGEM
Em PRATICAMENTE TODA mensagem, ofereça de 2 a 4 opções clicáveis ao FINAL, com este bloco:
<OPTIONS>["Opção curta 1","Opção curta 2","Opção curta 3"]</OPTIONS>
Cada opção com no máximo ~4 palavras. Mesmo em perguntas mais abertas, dê EXEMPLOS como opções —
a pessoa pode clicar numa ou digitar a dela. Exemplos:
- habilidade: <OPTIONS>["Eletricista","Diarista","Pedreiro","Outro serviço"]</OPTIONS>
- tipo de cliente: <OPTIONS>["Residências","Comércios","Os dois"]</OPTIONS>
- região: <OPTIONS>["Só minha cidade","Cidade e vizinhas","Todo o estado","Atendo online"]</OPTIONS>
- tempo de experiência: <OPTIONS>["Menos de 1 ano","1 a 3 anos","Mais de 5 anos"]</OPTIONS>
- enviar foto/portfólio/áudio: <OPTIONS>["Sim, vou enviar","Agora não"]</OPTIONS>
REGRA: SÓ NÃO inclua OPTIONS quando estiver pedindo um dado único e pessoal que precisa ser DIGITADO —
ou seja, apenas em: nome, CPF, RG e WhatsApp. Em TODO o resto, SEMPRE inclua o bloco <OPTIONS>.

# Finalização
Quando já tiver nome + entendimento claro do serviço + região de atendimento + uma noção de experiência
+ CPF + WhatsApp (foto/portfólio/áudio/RG são desejáveis mas opcionais), FINALIZE retornando EXATAMENTE
este bloco e NADA MAIS (sem OPTIONS junto):
<PROFILE>
{
  "nome": "...",
  "headline": "título curto, ex: 'Eletricista residencial • 8 anos de experiência'",
  "skills": ["habilidade1", "habilidade2"],
  "cidade": "...",
  "estado": "UF",
  "regiao": "região/raio que ela quer atender, ex: 'Araraquara e cidades vizinhas'",
  "cpf": "só dígitos, ex: 12345678900",
  "rg": "só dígitos ou vazio se não informado",
  "whatsapp": "número com DDD, só dígitos, ex: 11999998888",
  "bio": "2 a 3 frases descrevendo a experiência da pessoa, em terceira pessoa, para o perfil público"
}
</PROFILE>

Se ainda faltar algo obrigatório, faça apenas a próxima pergunta (com OPTIONS quando couber). Se a
pessoa se recusar a dar o CPF, explique gentilmente que é necessário para o perfil verificado, mas não
invente um número.`

interface Msg { role: 'user' | 'assistant'; content: string }

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  const b = content.find(x => x.type === 'text')
  return b && b.type === 'text' ? b.text : ''
}

export async function POST(req: NextRequest) {
  // Rate limit: 30 msgs/min por IP (conversa é mais chatty, mas evita abuso)
  const rl = rateLimit(`onboard:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'sem_api_key' }, { status: 500 })

  let messages: Msg[] = []
  let demandContext = ''
  try {
    const body = await req.json()
    messages = (body.messages ?? []).filter((m: Msg) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    demandContext = typeof body.demandContext === 'string' ? body.demandContext.slice(0, 600) : ''
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  if (!messages.length) {
    return NextResponse.json({ ok: false, error: 'sem_mensagens' }, { status: 400 })
  }

  try {
    const claude = new Anthropic({ apiKey })
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ]
    if (demandContext) {
      systemBlocks.push({
        type: 'text',
        text:
          `CONTEXTO IMPORTANTE: a pessoa acabou de se candidatar a este pedido na Bikco:\n"${demandContext}"\n\n` +
          `Comece a conversa reconhecendo isso de forma calorosa (ex.: "Vi que você se candidatou ao pedido X!"), ` +
          `e pergunte logo se ela já tem EXPERIÊNCIA com esse tipo de serviço e com o que mais ela trabalha. ` +
          `Use o tipo de serviço do pedido como a primeira habilidade do perfil. Siga coletando o resto normalmente.`,
      })
    }
    const res = await claude.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      system: systemBlocks,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const raw = textOf(res.content)

    // 1) Bloco de perfil finalizado?
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

    // 2) Opções rápidas (quick replies estilo botões)?
    let reply = raw
    let options: string[] | undefined
    const optMatch = raw.match(/<OPTIONS>([\s\S]*?)<\/OPTIONS>/)
    if (optMatch) {
      try {
        const arr = JSON.parse(optMatch[1].trim())
        if (Array.isArray(arr)) {
          options = arr.map((x) => String(x)).filter((s) => s.trim()).slice(0, 4)
        }
      } catch { /* ignora opções malformadas */ }
      reply = raw.replace(/<OPTIONS>[\s\S]*?<\/OPTIONS>/, '').trim()
    }

    return NextResponse.json({ ok: true, finished: false, reply, options })
  } catch (e) {
    console.error('[onboarding-chat] error:', e)
    return NextResponse.json({ ok: false, error: 'claude_error' }, { status: 502 })
  }
}
