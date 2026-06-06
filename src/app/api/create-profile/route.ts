import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/* Creates/updates the logged-in user's professional profile.
   Runs server-side using the auth cookie — avoids the browser session-client
   lock deadlock that hangs writes. RLS still applies (acts as the user). */

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

export async function POST(req: NextRequest) {
  const rl = rateLimit(`profile:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const userId = (userRow as { id: string } | null)?.id
  if (!userId) return NextResponse.json({ ok: false, error: 'sem_usuario' }, { status: 400 })

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
    // 1) basic user info (incl. WhatsApp + foto de perfil)
    await supabase.from('users').update({
      full_name:          nome,
      bio:                bio ?? null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      ...(phone ? { phone, phone_country_code: '+55' } : {}),
    }).eq('id', userId)

    // 1b) selo "verificado" quando há CPF (best-effort: ignora se a coluna
    //     ainda não existir no banco — ver SQL de is_verified).
    if (cpfNum) {
      await supabase.from('users').update({ is_verified: true }).eq('id', userId)
    }

    // 2) professional profile (insert or update)
    const { data: existing } = await supabase
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
      ? await supabase.from('professional_profiles').update(payload).eq('id', (existing as { id: string }).id)
      : await supabase.from('professional_profiles').insert(payload)

    if (error) {
      console.error('[create-profile] db error:', error.code, error.message)
      return NextResponse.json({ ok: false, error: error.message ?? 'db_error' }, { status: 400 })
    }

    // 3) verificação (CPF/RG) — tabela PRIVADA, só o dono lê. Upsert.
    if (cpfNum || rgNum) {
      const { error: vErr } = await supabase.from('user_verification').upsert({
        user_id:    userId,
        cpf:        cpfNum,
        rg:         rgNum,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (vErr) console.error('[create-profile] verification error:', vErr.code, vErr.message)
      // não falha o cadastro inteiro se a verificação não gravar
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[create-profile] exception:', e)
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500 })
  }
}
