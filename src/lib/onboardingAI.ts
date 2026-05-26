import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'

/* ─── System prompt (compartilhado com /api/onboarding-ia) ── */
export const ONBOARDING_SYSTEM_PROMPT = `Você é um assistente da Bikco, plataforma de profissionais de serviços do Brasil.
Seu objetivo é descobrir as habilidades profissionais do usuário em NO MÁXIMO 4 perguntas curtas e objetivas.

Regras:
- Perguntas diretas e curtas (máx 2 linhas)
- Comece com o nome se ainda não souber
- Pergunte sobre o serviço principal, depois especialidades, depois cidades que atende
- Quando tiver o suficiente (nome + pelo menos 1 habilidade + cidade), retorne um JSON

Quando estiver pronto para finalizar, retorne EXATAMENTE neste formato (nada mais):
<PROFILE>
{
  "nome": "...",
  "skills": ["habilidade1", "habilidade2"],
  "cidade": "...",
  "bio": "frase curta descrevendo o profissional"
}
</PROFILE>

Se ainda precisar de mais informações, retorne apenas a próxima pergunta em texto simples.`

/* ─── Types ───────────────────────────────────────────────── */
export interface WaMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OnboardingProfile {
  nome:   string
  skills: string[]
  cidade: string
  bio:    string
}

export interface OnboardingResult {
  reply:    string
  finished: boolean
  profile?: OnboardingProfile
}

/* ─── Chama Claude com o histórico da conversa ───────────── */
export async function runOnboarding(messages: WaMessage[]): Promise<OnboardingResult> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let reply = ''
  try {
    const response = await claude.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 512,
      system:     ONBOARDING_SYSTEM_PROMPT,
      messages:   messages.map(m => ({ role: m.role, content: m.content })),
    })
    reply = (response.content[0] as { type: string; text: string }).text ?? ''
  } catch (e) {
    console.error('[onboardingAI] Claude error:', e)
    return { reply: 'Desculpe, tive um probleminha. Pode repetir sua última mensagem?', finished: false }
  }

  const profileMatch = reply.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
  if (profileMatch) {
    try {
      const profile: OnboardingProfile = JSON.parse(profileMatch[1].trim())
      return { reply, finished: true, profile }
    } catch {
      return { reply: 'Não consegui salvar. Pode me dar o nome, habilidades e cidade de novo?', finished: false }
    }
  }

  return { reply, finished: false }
}

/* ─── Salva/atualiza perfil no Supabase por telefone ────── */
export async function saveOnboardingProfile(
  supabase: SupabaseClient,
  phone:    string,
  profile:  OnboardingProfile,
): Promise<string | null> {
  const digits     = phone.replace(/\D/g, '')
  const localPhone = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null)

  const found = (allProfiles ?? []).find(p => {
    const d = String(p.phone ?? '').replace(/\D/g, '')
    const l = d.startsWith('55') ? d.slice(2) : d
    return l === localPhone
  })

  if (found?.id) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.nome,
        skills:    profile.skills,
        city:      profile.cidade,
        bio:       profile.bio,
      })
      .eq('id', found.id)
    if (error) console.error('[onboardingAI] update error:', error)
    return found.id
  }

  console.warn('[onboardingAI] nenhum perfil encontrado para phone:', phone)
  return null
}
