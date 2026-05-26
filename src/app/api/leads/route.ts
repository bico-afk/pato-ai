import { NextRequest, NextResponse }            from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAuthUser, unauthorized }             from '@/lib/auth'

export async function POST(req: NextRequest) {
  /* ── Autenticação ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const {
      nome, telefone, cidade, categoria, fonte,
      google_place_id, site_url, score_externo,
      avaliacao_google, total_reviews, action,
    } = body

    /* ── Valida campo action ── */
    const VALID_ACTIONS = ['ligar', 'whatsapp', null, undefined]
    if (!VALID_ACTIONS.includes(action as string | null | undefined)) {
      return NextResponse.json({ ok: false, error: 'action inválido' }, { status: 400 })
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,  // service role para gravar
    )

    await supabase.from('leads').insert({
      nome:             nome             ?? null,
      telefone:         telefone         ?? null,
      cidade:           cidade           ?? null,
      categoria:        categoria        ?? null,
      fonte:            fonte            ?? 'google',
      google_place_id:  google_place_id  ?? null,
      site_url:         site_url         ?? null,
      score_externo:    score_externo    ?? null,
      avaliacao_google: avaliacao_google ?? null,
      total_reviews:    total_reviews    ?? null,
      status:           'novo',
      contatado:        action === 'ligar' || action === 'whatsapp',
      criado_por:       user.id,          // audit trail
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[leads] error:', e)
    return NextResponse.json({ ok: false })
  }
}
