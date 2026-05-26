import { NextRequest, NextResponse }          from 'next/server'
import Anthropic                               from '@anthropic-ai/sdk'
import { createClient as createSupabase }      from '@supabase/supabase-js'
import { getAuthUser, unauthorized }           from '@/lib/auth'
import { ONBOARDING_SYSTEM_PROMPT }            from '@/lib/onboardingAI'

/* ─── Clients ─────────────────────────────────────────────── */
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function db() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/* ─── Z-API send helper ───────────────────────────────────── */
async function sendWA(phone: string, message: string) {
  const instance = (process.env.ZAPI_INSTANCE ?? '').trim()
  const token    = (process.env.ZAPI_TOKEN    ?? '').trim()
  if (!instance || !token) return
  await fetch(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, message }),
    },
  ).catch(() => {})
}

/* ─── Tipos ───────────────────────────────────────────────── */
interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  phone:    string
  messages: Message[]
}

/* ═══════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  /* ── Autenticação ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  /* ── Parse body ── */
  let body: RequestBody
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }) }

  const { phone, messages } = body
  if (!phone || !messages?.length) {
    return NextResponse.json({ ok: false, error: 'phone e messages são obrigatórios' }, { status: 400 })
  }

  /* ── Chama Claude ─────────────────────────────────────── */
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
    console.error('[onboarding-ia] Claude error:', e)
    return NextResponse.json({ ok: false, error: 'claude_error' }, { status: 500 })
  }

  /* ── Verifica se Claude retornou o perfil completo ─────── */
  const profileMatch = reply.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)

  if (profileMatch) {
    let profile: { nome: string; skills: string[]; cidade: string; bio: string }
    try {
      profile = JSON.parse(profileMatch[1].trim())
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_profile_json' }, { status: 500 })
    }

    const supabase = db()
    const digits   = phone.replace(/\D/g, '')
    const localPhone = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .not('phone', 'is', null)

    const found = (existing ?? []).find(p => {
      const d = (p as { phone?: string }).phone?.replace(/\D/g, '') ?? ''
      const l = d.startsWith('55') ? d.slice(2) : d
      return l === localPhone
    })

    if (found?.id) {
      await supabase
        .from('profiles')
        .update({
          full_name: profile.nome,
          skills:    profile.skills,
          city:      profile.cidade,
          bio:       profile.bio,
          skills_ia: profile.skills,
          category:  profile.skills[0] ?? null,
        })
        .eq('id', found.id)
    }

    const confirmMsg =
      `✅ Perfil criado na Bikco!\n\n` +
      `👤 *${profile.nome}*\n` +
      `🔧 ${profile.skills.join(', ')}\n` +
      `📍 ${profile.cidade}\n\n` +
      `Agora você vai receber notificações de bicos na sua região. 🟡\n` +
      `Acesse *bikco.com* para completar seu perfil com foto e portfólio.`

    await sendWA(phone, confirmMsg)

    return NextResponse.json({ ok: true, finished: true, profile, reply: confirmMsg })
  }

  /* ── Ainda em conversa ── */
  await sendWA(phone, reply)
  return NextResponse.json({ ok: true, finished: false, reply })
}
