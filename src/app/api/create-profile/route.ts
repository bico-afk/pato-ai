import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/* Creates/updates the logged-in user's professional profile.
   Runs server-side using the auth cookie — avoids the browser session-client
   lock deadlock that hangs writes. RLS still applies (acts as the user). */

interface ProfileBody {
  nome?:     string
  headline?: string
  skills?:   string[]
  cidade?:   string
  estado?:   string
  bio?:      string
}

export async function POST(req: NextRequest) {
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

  const { nome, headline, skills, cidade, estado, bio } = body
  if (!nome || !skills?.length || !cidade) {
    return NextResponse.json({ ok: false, error: 'dados_incompletos' }, { status: 400 })
  }

  try {
    // 1) basic user info
    await supabase.from('users').update({
      full_name: nome,
      bio:       bio ?? null,
    }).eq('id', userId)

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
      is_available:     true,
    }

    const { error } = existing
      ? await supabase.from('professional_profiles').update(payload).eq('id', (existing as { id: string }).id)
      : await supabase.from('professional_profiles').insert(payload)

    if (error) {
      console.error('[create-profile] db error:', error.code, error.message)
      return NextResponse.json({ ok: false, error: error.message ?? 'db_error' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[create-profile] exception:', e)
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500 })
  }
}
