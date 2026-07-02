import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/* Publica uma demanda (pedido).
   Identidade: lida pelo COOKIE de auth (getUser) — OPCIONAL (publicar pode ser
   anônimo). Gravação: sempre com a SERVICE ROLE (ignora RLS). Isso evita o
   deadlock do session-client no navegador (auth-lock) e qualquer trava de RLS.
   Se logado → grava user_id. Se anônimo → grava anonymous_token. */

interface Body {
  title?:            string
  description?:      string
  location_city?:    string
  location_state?:   string
  location_country?: string
  location_point?:   string | null
  media_urls?:       string[] | null
  language?:         string
  anonymous_token?:  string
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`publish:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const description = (body.description ?? '').trim()
  if (!description) {
    return NextResponse.json({ ok: false, error: 'descricao_vazia' }, { status: 400 })
  }

  const db = admin()

  // 1) Identidade (opcional) — se houver sessão, atribui a demanda ao usuário.
  let userId: string | null = null
  try {
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    if (user) {
      const { data: userRow } = await db.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      userId = (userRow as { id: string } | null)?.id ?? null
      if (!userId) {
        // Cria a linha em public.users na hora (à prova de corrida).
        const username = `usuario_${Math.random().toString(36).slice(2, 8)}`
        const { data: created } = await db.from('users').insert({
          auth_id:      user.id,
          username,
          phone:        user.phone ? user.phone.replace(/\D/g, '') : null,
          email:        user.email ?? null,
          is_anonymous: false,
        }).select('id').maybeSingle()
        userId = (created as { id: string } | null)?.id ?? null
      }
    }
  } catch (e) {
    // Sem sessão válida → segue como anônimo. Nunca bloqueia a publicação.
    console.error('[publish-demand] auth opcional falhou:', e)
  }

  // 2) Monta a linha. Owner = user_id (logado) OU anonymous_token (anônimo).
  const anonToken = (body.anonymous_token ?? '').trim()
  if (!userId && !anonToken) {
    return NextResponse.json({ ok: false, error: 'sem_identidade' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    title:            (body.title?.trim() || description.slice(0, 80)).slice(0, 120),
    description,
    location_city:    body.location_city    ?? '',
    location_state:   body.location_state   ?? '',
    location_country: body.location_country ?? 'BR',
    location_point:   body.location_point   ?? null,
    media_urls:       body.media_urls?.length ? body.media_urls : null,
    status:           'open',
    language:         body.language ?? 'pt',
    candidate_count:  0,
    ...(userId ? { user_id: userId } : { anonymous_token: anonToken }),
  }

  let { data, error } = await db.from('demands').insert(row).select('id').maybeSingle()

  // Fallback defensivo: a coluna anonymous_token tem (historicamente) restrição
  // UNIQUE, o que impede o MESMO navegador anônimo de publicar mais de um pedido.
  // Se bater violação de unicidade (23505), reinsere com um token único por
  // pedido — assim a publicação nunca falha. (Corrija a raiz com o SQL que
  // remove o UNIQUE de demands.anonymous_token.)
  if (error && !userId && (error.code === '23505' || /duplicat|unique/i.test(error.message ?? ''))) {
    const uniqueToken = `${anonToken}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const retry = await db.from('demands')
      .insert({ ...row, anonymous_token: uniqueToken })
      .select('id').maybeSingle()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('[publish-demand] insert error:', error.code, error.message, error.details, error.hint)
    return NextResponse.json({
      ok: false,
      error: error.message ?? 'db_error',
      _debug: {
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        urlHost: (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host } catch { return null } })(),
      },
    }, { status: 400 })
  }

  const id = (data as { id: string } | null)?.id ?? null

  // 3) Dispara matching → WhatsApp (fire-and-forget; não bloqueia a resposta).
  if (id) {
    const origin = req.nextUrl.origin
    fetch(`${origin}/api/notify-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': '1' },
      body: JSON.stringify({ demandId: id }),
    }).catch(() => { /* não-fatal */ })
  }

  return NextResponse.json({ ok: true, id })
}
