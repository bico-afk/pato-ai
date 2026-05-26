import { createClient as createSupabase } from '@supabase/supabase-js'

/* ─── Z-API send ──────────────────────────────────────────── */
async function sendWA(phone: string, message: string): Promise<void> {
  const instance = (process.env.ZAPI_INSTANCE ?? '').trim()
  const token    = (process.env.ZAPI_TOKEN    ?? '').trim()
  if (!instance || !token) return
  await fetch(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, message }),
    },
  ).catch(e => console.error('[notifyProfessionals] Z-API send error:', e))
}

/* ─── Normaliza texto para comparação ─────────────────────── */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/* ─── Verifica compatibilidade de habilidades ─────────────── */
function skillsMatch(
  jobDescription: string,
  jobCategory:    string | null,
  profileSkills:  string[] | null,
): boolean {
  if (!profileSkills?.length) return false
  const desc = normalize(jobDescription + ' ' + (jobCategory ?? ''))
  return profileSkills.some(skill => desc.includes(normalize(skill)))
}

/* ═══════════════════════════════════════════════════════════ */
export interface JobPayload {
  id:          string
  descricao:   string
  categoria?:  string | null
  cidade?:     string | null
}

/**
 * Busca profissionais compatíveis e envia notificação via WhatsApp.
 * Máximo de 10 notificações por pedido.
 */
export async function notifyProfessionals(job: JobPayload): Promise<number> {
  // Usa service role key para leitura de profiles (phone), com fallback para anon key
  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  /* Busca profissionais com phone e skills */
  const { data: professionals, error: dbErr } = await supabase
    .from('profiles')
    .select('id, full_name, phone, skills, city')
    .not('phone', 'is', null)
    .not('skills', 'is', null)

  if (dbErr) console.error('[notifyProfessionals] Supabase error:', dbErr)
  if (!professionals?.length) return 0

  // Normaliza cidade: pega só o primeiro segmento antes da vírgula (ex: "São Paulo, SP" → "sao paulo")
  const normalizeCity = (s: string) => normalize(s.split(',')[0])
  const cidade = normalizeCity(job.cidade ?? '')

  /* Filtra por região e habilidades */
  const matches = professionals.filter(p => {
    /* Região */
    const profCity = normalizeCity(p.city ?? '')
    if (cidade && profCity && !profCity.includes(cidade) && !cidade.includes(profCity)) {
      return false
    }

    /* Habilidades */
    const skills: string[] = (p.skills ?? []) as string[]
    return skillsMatch(job.descricao, job.categoria ?? null, skills)
  })

  /* Limita a 10 */
  const toNotify = matches.slice(0, 10)

  const msg =
    `🟡 *Novo bico para você em ${job.cidade ?? 'sua região'}!*\n\n` +
    `📋 ${job.descricao}\n` +
    (job.categoria ? `🏷️ Categoria: ${job.categoria}\n` : '') +
    `\nQuer se candidatar? Responda *SIM* e te conecto ao cliente!\n\n` +
    `_Bikco — bikco.com_`

  let sent = 0
  for (const prof of toNotify) {
    if (!prof.phone) continue
    await sendWA(prof.phone as string, msg)
    sent++
    /* Pequena pausa para não sobrecarregar a API */
    await new Promise(r => setTimeout(r, 120))
  }

  return sent
}
