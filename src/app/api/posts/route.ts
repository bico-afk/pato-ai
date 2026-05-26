import { NextRequest, NextResponse }     from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { notifyProfessionals }            from '@/lib/notifyProfessionals'
import { getAuthUser, unauthorized }      from '@/lib/auth'

function db() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  /* ── Autenticação ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  /* ── Parse body ── */
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }) }

  const {
    title, description, category, urgency,
    budget_min, budget_max, city, photo_url, lat, lng,
  } = body as {
    title:        string
    description?: string
    category?:    string
    urgency?:     string
    budget_min?:  number
    budget_max?:  number
    city?:        string
    photo_url?:   string
    lat?:         number
    lng?:         number
  }

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ ok: false, error: 'title é obrigatório' }, { status: 400 })
  }
  if (String(title).trim().length < 3) {
    return NextResponse.json({ ok: false, error: 'Título muito curto (mín 3 caracteres)' }, { status: 400 })
  }
  if (String(title).trim().length > 200) {
    return NextResponse.json({ ok: false, error: 'Título muito longo (máx 200 caracteres)' }, { status: 400 })
  }

  /* ── Validação de orçamento ── */
  const bMin = budget_min != null ? Number(budget_min) : null
  const bMax = budget_max != null ? Number(budget_max) : null
  if (bMin !== null && (isNaN(bMin) || bMin < 0)) {
    return NextResponse.json({ ok: false, error: 'budget_min inválido' }, { status: 400 })
  }
  if (bMax !== null && (isNaN(bMax) || bMax < 0)) {
    return NextResponse.json({ ok: false, error: 'budget_max inválido' }, { status: 400 })
  }
  if (bMin !== null && bMax !== null && bMax < bMin) {
    return NextResponse.json({ ok: false, error: 'budget_max deve ser maior que budget_min' }, { status: 400 })
  }
  if (bMax !== null && bMax > 1_000_000) {
    return NextResponse.json({ ok: false, error: 'Orçamento máximo excedido' }, { status: 400 })
  }

  /* ── Rate limit: máx 10 pedidos por hora por usuário ── */
  const supabase = db()
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

  /* ── Insere o pedido usando o ID da sessão (não do body) ── */
  const { data: post, error: insertErr } = await supabase
    .from('posts')
    .insert({
      user_id:     user.id,
      title:       String(title).trim(),
      description: description ? String(description).trim() : null,
      category:    category    ?? null,
      urgency:     urgency     ?? null,
      budget_min:  bMin,
      budget_max:  bMax,
      city:        city ? String(city).trim() : null,
      photo_url:   photo_url   ?? null,
      lat:         lat         ?? null,
      lng:         lng         ?? null,
      status:      'aberto',
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[api/posts] insert error:', insertErr)
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 })
  }

  /* ── Notifica profissionais (fire-and-forget) ── */
  const notified = await notifyProfessionals({
    id:        post.id,
    descricao: String(description ?? title),
    categoria: category ?? null,
    cidade:    city     ?? null,
  }).catch(e => { console.error('[api/posts] notifyProfessionals error:', e); return 0 })

  console.log(`[api/posts] ✓ pedido ${post.id} — ${notified} profissionais notificados`)
  return NextResponse.json({ ok: true, post, notified })
}
