import { NextRequest, NextResponse }     from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { getAuthUser, unauthorized }      from '@/lib/auth'

export async function POST(req: NextRequest) {
  /* ── Autenticação (inclui sessões anônimas do signInAnonymously) ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  /* ── Parse body ── */
  let body: { text?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }) }

  const text = body.text?.trim() ?? ''
  if (!text) {
    return NextResponse.json({ ok: false, error: 'text é obrigatório' }, { status: 400 })
  }
  if (text.length > 500) {
    return NextResponse.json({ ok: false, error: 'Texto muito longo (máx 500 caracteres)' }, { status: 400 })
  }

  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  /* ── Rate limit: máx 10 posts por hora por usuário ── */
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= 10) {
    return NextResponse.json(
      { ok: false, error: 'Limite de 10 pedidos por hora atingido. Tente novamente mais tarde.' },
      { status: 429 },
    )
  }

  /* ── Insere usando o user.id verificado da sessão ── */
  const { data, error } = await supabase
    .from('posts')
    .insert({ title: text, status: 'aberto', user_id: user.id })
    .select('id, created_at, title, city, user_id')
    .single()

  if (error) {
    console.error('[quick-post] insert error:', error.code, error.message)
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 })
  }

  console.log('[quick-post] ✓ post criado id=', data.id, 'user=', user.id)
  return NextResponse.json({ ok: true, post: data })
}
