import { createClient } from '@supabase/supabase-js'

/* ───────────────────────────────────────────────────────────────
   Motor de matching da Bikco (visão #2):
   quando um pedido (demand) é publicado, encontra os PROFISSIONAIS
   cujas habilidades batem com o serviço (e região) e dispara um
   WhatsApp automático (via Z-API) direcionando ao pedido.

   Usa SERVICE ROLE (bypass RLS) para ler users.phone com segurança
   no servidor. Idempotente: marca demands.notified_at e não repete.
   ─────────────────────────────────────────────────────────────── */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pato-ai-phi.vercel.app').replace(/\/$/, '')
const MAX_NOTIFY = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function normalize(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function skillsMatch(text: string, skills: string[]): boolean {
  if (!skills?.length) return false
  return skills.some(skill => {
    const s = normalize(skill)
    return s.length >= 3 && text.includes(s)
  })
}

/** Monta o número no formato do Z-API (ex.: 5511999998888). */
function toZapiPhone(phone: string | null | undefined, cc: string | null | undefined): string | null {
  let d = (phone ?? '').replace(/\D/g, '')
  if (!d) return null
  const ccd = (cc ?? '+55').replace(/\D/g, '') || '55'
  if (!d.startsWith(ccd)) {
    if (d.length <= 11) d = ccd + d
  }
  return d.length >= 12 ? d : null
}

async function sendWA(phone: string, message: string): Promise<boolean> {
  const instance    = (process.env.ZAPI_INSTANCE     ?? '').trim()
  const token       = (process.env.ZAPI_TOKEN        ?? '').trim()
  const clientToken = (process.env.ZAPI_CLIENT_TOKEN ?? '').trim()
  if (!instance || !token) { console.error('[matchDemand] ZAPI ausente'); return false }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
      method: 'POST', headers, body: JSON.stringify({ phone, message }),
    })
    if (!res.ok) console.error('[matchDemand] z-api http', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (e) { console.error('[matchDemand] z-api fetch', e); return false }
}

export interface DemandRow {
  id: string
  title?: string | null
  description?: string | null
  location_city?: string | null
  location_state?: string | null
  user_id?: string | null
  status?: string | null
  notified_at?: string | null
}

interface ProRow {
  skills: string[] | null
  location_city: string | null
  is_available: boolean | null
  user_id: string
  users: { id: string; phone: string | null; phone_country_code: string | null; full_name: string | null } | null
}

export async function matchDemand(demand: DemandRow): Promise<{ matched: number; sent: number; skipped?: string }> {
  if (!demand?.id) return { matched: 0, sent: 0, skipped: 'sem_id' }
  if (demand.status && demand.status !== 'open') return { matched: 0, sent: 0, skipped: 'nao_aberto' }
  if (demand.notified_at) return { matched: 0, sent: 0, skipped: 'ja_notificado' }

  const supabase = db()

  const { data: pros, error } = await supabase
    .from('professional_profiles')
    .select('skills, location_city, is_available, user_id, users:user_id ( id, phone, phone_country_code, full_name )')
    .not('skills', 'is', null)
  if (error) { console.error('[matchDemand] erro pros:', error.message); return { matched: 0, sent: 0, skipped: 'erro_db' } }

  const text  = normalize(`${demand.title ?? ''} ${demand.description ?? ''}`)
  const dcity = normalize((demand.location_city ?? '').split(',')[0])

  const matches = (pros as unknown as ProRow[]).filter(p => {
    const u = p.users
    if (!u?.phone) return false
    if (p.is_available === false) return false
    if (demand.user_id && u.id === demand.user_id) return false // não avisa o próprio autor
    const pcity = normalize((p.location_city ?? '').split(',')[0])
    if (dcity && pcity && !pcity.includes(dcity) && !dcity.includes(pcity)) return false
    return skillsMatch(text, p.skills ?? [])
  })

  const titulo = (demand.title || (demand.description ?? '').slice(0, 60) || 'Novo pedido').trim()
  const local  = demand.location_city ? `${demand.location_city}${demand.location_state ? ', ' + demand.location_state : ''}` : 'sua região'
  const link   = `${SITE}/pedido/${demand.id}`

  let sent = 0
  for (const p of matches.slice(0, MAX_NOTIFY)) {
    const phone = toZapiPhone(p.users!.phone, p.users!.phone_country_code)
    if (!phone) continue
    const nome = (p.users!.full_name ?? '').split(' ')[0]
    const msg =
      `🟡 *Novo bico pra você na Bikco${nome ? ', ' + nome : ''}!*\n\n` +
      `📋 ${titulo}\n` +
      `📍 ${local}\n\n` +
      `Bate com a sua habilidade. Quer pegar?\n` +
      `👉 Veja os detalhes e candidate-se:\n${link}\n\n` +
      `_Você recebeu porque cadastrou essa habilidade na Bikco._`
    if (await sendWA(phone, msg)) sent++
    await new Promise(r => setTimeout(r, 150))
  }

  // marca como notificado (idempotência) — mesmo que 0 enviados, evita reprocessar
  await supabase.from('demands').update({ notified_at: new Date().toISOString() }).eq('id', demand.id)

  return { matched: matches.length, sent }
}
