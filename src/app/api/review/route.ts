import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/* Avaliação (1–5 ⭐) de um participante por outro, dentro de um chat.
   Identidade pelo cookie; gravação com service role (escopada ao chat).
   O trigger update_professional_rating recalcula a nota do avaliado. */

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

interface Body { chatId?: string; rating?: number; comment?: string }

export async function POST(req: NextRequest) {
  const rl = rateLimit(`review:${clientIp(req)}`, 15, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }
  const chatId = body.chatId
  const rating = Math.round(Number(body.rating))
  const comment = (body.comment ?? '').toString().slice(0, 500) || null
  if (!chatId || !(rating >= 1 && rating <= 5)) {
    return NextResponse.json({ ok: false, error: 'dados_invalidos' }, { status: 400 })
  }

  const db = admin()
  const { data: callerRow } = await db.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const callerId = (callerRow as { id: string } | null)?.id
  if (!callerId) return NextResponse.json({ ok: false, error: 'sem_usuario' }, { status: 400 })

  // valida que o chamador participa do chat e descobre quem está sendo avaliado
  const { data: chatRow } = await db.from('chats')
    .select('id, client_id, professional_id, demand_id').eq('id', chatId).maybeSingle()
  const chat = chatRow as { id: string; client_id: string | null; professional_id: string | null; demand_id: string | null } | null
  if (!chat) return NextResponse.json({ ok: false, error: 'sem_chat' }, { status: 404 })
  if (chat.client_id !== callerId && chat.professional_id !== callerId) {
    return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })
  }
  const reviewedId = chat.client_id === callerId ? chat.professional_id : chat.client_id
  if (!reviewedId) return NextResponse.json({ ok: false, error: 'sem_avaliado' }, { status: 400 })

  const { error } = await db.from('reviews').upsert({
    demand_id:   chat.demand_id,
    chat_id:     chat.id,
    reviewer_id: callerId,
    reviewed_id: reviewedId,
    rating,
    comment,
  }, { onConflict: 'chat_id,reviewer_id' })

  if (error) {
    console.error('[review] erro:', error.code, error.message)
    return NextResponse.json({ ok: false, error: error.message ?? 'db_error' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
