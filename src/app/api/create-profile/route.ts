import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/* Cria/atualiza o perfil profissional do usuário logado.
   Identidade: lida pelo COOKIE de auth (getUser). Gravações: feitas com a
   SERVICE ROLE (ignora RLS) — seguro porque tudo é escopado ao userId do
   próprio usuário já verificado. Isso evita qualquer trava de RLS no caminho. */

interface ProfileBody {
  nome?:          string
  headline?:      string
  skills?:        string[]
  cidade?:        string
  estado?:        string
  regiao?:        string
  bio?:           string
  whatsapp?:      string
  cpf?:           string
  rg?:            string
  avatarUrl?:     string
  portfolioUrls?: string[]
  audioUrl?:      string
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`profile:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  // 1) Identifica quem está logado (pelo cookie)
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  // 2) Daqui pra frente, grava com a service role (sem RLS no meio)
  const db = admin()

  const { data: userRow } = await db.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  let userId = (userRow as { id: string } | null)?.id

  if (!userId) {
    const username = `usuario_${Math.random().toString(36).slice(2, 8)}`
    const { data: created, error: cErr } = await db.from('users').insert({
      auth_id:      user.id,
      username,
      phone:        user.phone ? user.phone.replace(/\D/g, '') : null,
      email:        user.email ?? null,
      is_anonymous: false,
    }).select('id').maybeSingle()
    if (cErr || !created) {
      console.error('[create-profile] criar users falhou:', cErr?.code, cErr?.message)
      return NextResponse.json({ ok: false, error: 'sem_usuario' }, { status: 400 })
    }
    userId = (created as { id: string }).id
  }

  let body: ProfileBody
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const { nome, headline, skills, cidade, estado, regiao, bio, whatsapp,
          cpf, rg, avatarUrl, portfolioUrls, audioUrl } = body
  if (!nome || !skills?.length || !cidade) {
    return NextResponse.json({ ok: false, error: 'dados_incompletos' }, { status: 400 })
  }

  const phone   = (whatsapp ?? '').replace(/\D/g, '') || null
  const cpfNum  = (cpf ?? '').replace(/\D/g, '') || null
  const rgNum   = (rg  ?? '').replace(/[^\dxX]/g, '') || null
  const portfolio = (portfolioUrls ?? []).filter(u => typeof u === 'string' && u).slice(0, 6)

  try {
    // 1) dados básicos do usuário (nome, bio, foto, whatsapp, selo)
    const { error: uErr } = await db.from('users').update({
      full_name:          nome,
      bio:                bio ?? null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      ...(phone ? { phone, phone_country_code: '+55' } : {}),
      ...(cpfNum ? { is_verified: true } : {}),
    }).eq('id', userId)
    if (uErr) console.error('[create-profile] users update:', uErr.code, uErr.message)

    // 2) perfil profissional (insert ou update)
    const { data: existing } = await db
      .from('professional_profiles').select('id').eq('user_id', userId).maybeSingle()

    const payload = {
      user_id:          userId,
      headline:         headline ?? '',
      skills,
      location_city:    cidade,
      location_state:   estado ?? '',
      location_country: 'BR',
      ...(regiao ? { location_text: regiao } : {}),
      is_available:     true,
      ...(portfolio.length ? { portfolio_urls: portfolio } : {}),
      ...(audioUrl ? { audio_url: audioUrl } : {}),
    }

    const { error } = existing
      ? await db.from('professional_profiles').update(payload).eq('id', (existing as { id: string }).id)
      : await db.from('professional_profiles').insert(payload)

    if (error) {
      console.error('[create-profile] pp error:', error.code, error.message)
      return NextResponse.json({ ok: false, error: error.message ?? 'db_error' }, { status: 400 })
    }

    // 3) verificação (CPF/RG) — privado
    if (cpfNum || rgNum) {
      const { error: vErr } = await db.from('user_verification').upsert({
        user_id:    userId,
        cpf:        cpfNum,
        rg:         rgNum,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (vErr) console.error('[create-profile] verification error:', vErr.code, vErr.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[create-profile] exception:', e)
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500 })
  }
}
