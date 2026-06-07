import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooMany } from '@/lib/rateLimit'
import { sendWhatsApp } from '@/lib/zapi'

export const runtime = 'nodejs'

/* Notificações por WhatsApp nos momentos que movem o marketplace:
   - 'applied'  → avisa o DONO do pedido que alguém se candidatou (se ele tiver telefone)
   - 'accepted' → avisa o PROFISSIONAL que foi escolhido
   Identidade pelo cookie; dados/lookup com service role. Fire-and-forget no client. */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pato-ai-phi.vercel.app').replace(/\/$/, '')

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

interface Body { event?: 'applied' | 'accepted'; demandId?: string; professionalId?: string }

export async function POST(req: NextRequest) {
  const rl = rateLimit(`notify-evt:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)

  // identidade do chamador
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }
  const { event, demandId, professionalId } = body
  if (!event || !demandId) return NextResponse.json({ ok: false, error: 'dados' }, { status: 400 })

  const db = admin()
  const { data: callerRow } = await db.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const callerId = (callerRow as { id: string } | null)?.id
  if (!callerId) return NextResponse.json({ ok: false, error: 'sem_usuario' }, { status: 400 })

  const { data: demand } = await db.from('demands')
    .select('id, title, description, user_id').eq('id', demandId).maybeSingle()
  if (!demand) return NextResponse.json({ ok: false, error: 'sem_demand' }, { status: 404 })
  const d = demand as { id: string; title: string | null; description: string | null; user_id: string | null }
  const titulo = (d.title || (d.description ?? '').slice(0, 60) || 'seu pedido').trim()
  const link = `${SITE}/pedido/${d.id}`

  try {
    if (event === 'applied') {
      // só o próprio candidato pode disparar; avisa o dono
      if (professionalId && professionalId !== callerId) {
        return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })
      }
      if (!d.user_id) return NextResponse.json({ ok: true, skipped: 'dono_anonimo' })
      const { data: owner } = await db.from('users').select('phone, full_name').eq('id', d.user_id).maybeSingle()
      const phone = (owner as { phone: string | null } | null)?.phone
      if (!phone) return NextResponse.json({ ok: true, skipped: 'dono_sem_telefone' })

      const { data: pro } = await db.from('users').select('full_name').eq('id', callerId).maybeSingle()
      const proNome = (pro as { full_name: string | null } | null)?.full_name ?? 'Um profissional'
      const msg =
        `🔔 *Bikco* — alguém se candidatou ao seu pedido!\n\n` +
        `📋 ${titulo}\n👤 ${proNome} quer fazer esse bico.\n\n` +
        `Veja o perfil e responda:\n${link}`
      await sendWhatsApp(phone, msg)
      return NextResponse.json({ ok: true, sent: true })
    }

    if (event === 'accepted') {
      // só o DONO do pedido pode disparar; avisa o profissional escolhido
      if (d.user_id !== callerId) {
        return NextResponse.json({ ok: false, error: 'nao_autorizado' }, { status: 403 })
      }
      if (!professionalId) return NextResponse.json({ ok: false, error: 'sem_profissional' }, { status: 400 })
      const { data: pro } = await db.from('users').select('phone, full_name').eq('id', professionalId).maybeSingle()
      const phone = (pro as { phone: string | null } | null)?.phone
      if (!phone) return NextResponse.json({ ok: true, skipped: 'pro_sem_telefone' })
      const nome = ((pro as { full_name: string | null } | null)?.full_name ?? '').split(' ')[0]
      const msg =
        `🎉 *Bikco* — você foi escolhido${nome ? ', ' + nome : ''}!\n\n` +
        `O cliente aceitou sua candidatura no bico:\n📋 ${titulo}\n\n` +
        `Abra pra combinar os detalhes:\n${link}`
      await sendWhatsApp(phone, msg)
      return NextResponse.json({ ok: true, sent: true })
    }

    return NextResponse.json({ ok: false, error: 'evento_invalido' }, { status: 400 })
  } catch (e) {
    console.error('[notify] erro:', e)
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500 })
  }
}
