'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  seal: string | null
  score: number | null
  concluidos?: number | null
}

interface Post {
  id: string
  user_id: string
  title: string
  description: string | null
  urgency: string | null
  budget_min: number | null
  budget_max: number | null
  status: string
  created_at: string
}

interface Candidatura {
  id: string
  prestador_id: string
  status: string
  tipo: string | null
  valor: number | null
  horas_estimadas: number | null
  disponibilidade: string | null
  diferenciais: string | null
  proposta: string | null       // mensagem principal
  mensagem: string | null       // alias
  created_at: string
  profiles: Profile
}

type FilterKey = 'todas' | 'menor_preco' | 'melhor_avaliacao' | 'mais_rapido'

/* ─── Constants ──────────────────────────────────────────── */
const SEAL_COLOR: Record<string, string> = { ouro: '#FFD11A', prata: '#C0C0C0', bronze: '#CD7F32' }
const SEAL_LABEL: Record<string, string> = { ouro: 'OURO', prata: 'PRATA', bronze: 'BRONZE' }

const URGENCY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  hoje:       { label: '🔴 Hoje',       color: '#FF4D6A', bg: '#2a0511' },
  semana:     { label: '🟠 Esta semana', color: '#FF7A1A', bg: '#1f1005' },
  sem_pressa: { label: '⬛ Sem pressa',  color: '#888',    bg: '#181818' },
}

const TIPO_LABEL: Record<string, string> = {
  fixo:   '💰 Valor fixo',
  hora:   '⏱️ Por hora',
  visita: '🔍 Visita técnica',
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas',           label: 'Todas' },
  { key: 'menor_preco',     label: 'Menor preço' },
  { key: 'melhor_avaliacao',label: 'Melhor avaliação' },
  { key: 'mais_rapido',     label: 'Mais rápido' },
]

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function getMensagem(c: Candidatura): string {
  return c.mensagem || c.proposta || ''
}

/* ─── Sub-components ─────────────────────────────────────── */
function Avatar({ src, name, size = 44 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

function Stars({ score }: { score: number | null }) {
  const filled = Math.round(Math.min(5, Math.max(0, (score ?? 0) / 20)))
  return (
    <span style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= filled ? '#FFD11A' : '#333'} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

/* ─── ProposalCard ───────────────────────────────────────── */
function ProposalCard({
  cand,
  isFirst,
  onAccept,
  onReject,
  accepting,
  removing,
  chatId,
}: {
  cand: Candidatura
  isFirst: boolean
  onAccept: (c: Candidatura) => void
  onReject: (c: Candidatura) => void
  accepting: boolean
  removing: boolean
  chatId?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  const msg = getMensagem(cand)
  const truncated = msg.length > 160 && !expanded

  const urgInfo = URGENCY_MAP[cand.disponibilidade?.toLowerCase() === 'hoje' || cand.disponibilidade?.toLowerCase() === 'imediato' ? 'hoje' : 'sem_pressa']

  return (
    <div
      style={{
        margin: '0 16px 12px',
        transition: 'opacity 0.35s ease, transform 0.35s ease, max-height 0.4s ease',
        opacity: removing ? 0 : 1,
        transform: removing ? 'translateX(60px)' : 'none',
        maxHeight: removing ? 0 : 9999,
        overflow: removing ? 'hidden' : 'visible',
      }}
    >
      {isFirst && cand.status === 'pendente' && (
        <div style={{ backgroundColor: '#1a1500', borderRadius: '12px 12px 0 0', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #FFD11A33', borderBottom: 'none' }}>
          <span style={{ fontSize: 12 }}>⭐</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.06em' }}>PRIMEIRO A RESPONDER</span>
        </div>
      )}

      <div style={{
        backgroundColor: '#171717',
        borderRadius: isFirst && cand.status === 'pendente' ? '0 0 16px 16px' : 16,
        padding: 16,
        border: `1px solid ${cand.status === 'aceita' ? '#22C55E44' : cand.status === 'recusada' ? '#333' : isFirst ? '#FFD11A33' : '#222'}`,
        borderTop: isFirst && cand.status === 'pendente' ? 'none' : undefined,
        opacity: cand.status === 'recusada' ? 0.45 : 1,
      }}>

        {/* Row 1: avatar + name + seal + stars + time */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/usuario/${cand.profiles.id}`)}>
            <Avatar src={cand.profiles.avatar_url} name={cand.profiles.full_name} size={46} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + seal + status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer' }} onClick={() => router.push(`/usuario/${cand.profiles.id}`)}>
                {cand.profiles.full_name || 'Pato'}
              </span>
              {cand.profiles.seal && (
                <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_COLOR[cand.profiles.seal], border: `1px solid ${SEAL_COLOR[cand.profiles.seal]}55`, borderRadius: 4, padding: '1px 5px' }}>
                  {SEAL_LABEL[cand.profiles.seal]}
                </span>
              )}
              {cand.status === 'aceita' && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#22C55E', border: '1px solid #22C55E44', borderRadius: 4, padding: '1px 5px' }}>ACEITA</span>
              )}
              {cand.status === 'recusada' && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#888', border: '1px solid #333', borderRadius: 4, padding: '1px 5px' }}>RECUSADA</span>
              )}
            </div>

            {/* Row 2: stars + city + concluídos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <Stars score={cand.profiles.score} />
              {cand.profiles.city && (
                <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#555"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  {cand.profiles.city}
                </span>
              )}
              {(cand.profiles.concluidos ?? 0) > 0 && (
                <span style={{ fontSize: 11, color: '#22C55E' }}>
                  ✓ {cand.profiles.concluidos} bico{(cand.profiles.concluidos ?? 0) !== 1 ? 's' : ''} concluído{(cand.profiles.concluidos ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Time */}
          <span style={{ fontSize: 11, color: '#444', flexShrink: 0 }}>{timeAgo(cand.created_at)}</span>
        </div>

        {/* Tipo badge + Valor */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', backgroundColor: '#1e1e1e', borderRadius: 6, padding: '3px 8px' }}>
            {TIPO_LABEL[cand.tipo ?? 'fixo'] ?? '💰 Valor fixo'}
          </span>

          {cand.tipo === 'hora' ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD11A', lineHeight: 1 }}>
                R$ {fmt(cand.valor ?? 0)}<span style={{ fontSize: 13, fontWeight: 600 }}>/h</span>
              </div>
              {cand.horas_estimadas && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  {cand.horas_estimadas}h · total R$ {fmt((cand.valor ?? 0) * cand.horas_estimadas)}
                </div>
              )}
            </div>
          ) : cand.tipo === 'visita' ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD11A', lineHeight: 1 }}>
                {cand.valor ? `R$ ${fmt(cand.valor)}` : 'a combinar'}
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>visita técnica</div>
            </div>
          ) : cand.valor ? (
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD11A' }}>
              R$ {fmt(cand.valor)}
            </div>
          ) : null}
        </div>

        {/* Mensagem */}
        {msg.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#aaa', lineHeight: 1.65 }}>
              &ldquo;{truncated ? msg.slice(0, 157) + '…' : msg}&rdquo;
            </p>
            {msg.length > 160 && (
              <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0 0' }}>
                {expanded ? 'ver menos' : 'ver mais'}
              </button>
            )}
          </div>
        )}

        {/* Diferenciais */}
        {cand.diferenciais && (
          <div style={{ backgroundColor: '#1a1a0d', borderRadius: 8, padding: '8px 10px', marginBottom: 10, border: '1px solid #2a2a10' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#FFD11A', marginBottom: 3 }}>✨ DIFERENCIAIS</p>
            <p style={{ margin: 0, fontSize: 12, color: '#999', lineHeight: 1.55 }}>{cand.diferenciais}</p>
          </div>
        )}

        {/* Disponibilidade */}
        {cand.disponibilidade && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 12, color: '#666' }}>Disponível: {cand.disponibilidade}</span>
          </div>
        )}

        {/* Buttons */}
        {cand.status === 'pendente' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onReject(cand)}
              style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid #272727', backgroundColor: '#171717', color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Recusar
            </button>
            <button
              onClick={() => onAccept(cand)}
              disabled={accepting}
              style={{ flex: 2, height: 42, borderRadius: 10, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: accepting ? 0.7 : 1 }}
            >
              {accepting ? (
                <><div style={{ width: 14, height: 14, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> abrindo chat…</>
              ) : (
                <>Aceitar e abrir chat 💬</>
              )}
            </button>
          </div>
        )}

        {cand.status === 'aceita' && (
          <div style={{ backgroundColor: '#0d2a1a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #22C55E33' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 700 }}>Proposta aceita</span>
            </div>
            {chatId && (
              <button
                onClick={() => router.push(`/chat/${chatId}`)}
                style={{ backgroundColor: '#FFD11A', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#0F0F0F', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Abrir chat 💬
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function PropostasPage() {
  const router   = useRouter()
  const params   = useParams()
  const postId   = params.id as string
  const supabase = createClient()

  const [post,         setPost]         = useState<Post | null>(null)
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [userId,       setUserId]       = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<FilterKey>('todas')
  const [accepting,    setAccepting]    = useState<string | null>(null)
  const [removing,     setRemoving]     = useState<string | null>(null)
  const [acceptErr,    setAcceptErr]    = useState<string | null>(null)
  const [openChatId,   setOpenChatId]   = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  /* ── Load ── */
  const load = useCallback(async (uid: string) => {
    const { data: p } = await supabase.from('posts').select('*').eq('id', postId).single()
    if (!p || p.user_id !== uid) { router.replace('/feed'); return }
    setPost(p as Post)

    const { data: cands } = await supabase
      .from('candidaturas')
      .select(`
        id, prestador_id, status, tipo, valor, horas_estimadas,
        disponibilidade, diferenciais, proposta, mensagem, created_at,
        profiles(id, full_name, avatar_url, city, state, seal, score, concluidos)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })

    if (cands) setCandidaturas(cands as unknown as Candidatura[])

    // Se já tem uma candidatura aceita, busca o chat existente para exibir o botão
    const aceitaCand = (cands as unknown as Candidatura[] | null)?.find(c => c.status === 'aceita')
    if (aceitaCand) {
      const { data: conv } = await supabase
        .from('conversas')
        .select('id')
        .eq('post_id', postId)
        .eq('prestador_id', aceitaCand.prestador_id)
        .maybeSingle()
      if (conv?.id) setOpenChatId(conv.id)
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      userIdRef.current = data.user.id
      load(data.user.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  /* ── Accept ── */
  async function handleAccept(cand: Candidatura) {
    if (!userId || !post) return
    setAccepting(cand.id)

    try {
      // 1. Update candidatura status
      await supabase.from('candidaturas').update({ status: 'aceita' }).eq('id', cand.id)

      // 2. Create/find conversa — mesma abordagem que funciona em bico/[id]/page.tsx
      const { data: convData, error: convErr } = await supabase
        .from('conversas')
        .upsert(
          { post_id: postId, contratante_id: userId, prestador_id: cand.prestador_id },
          { onConflict: 'post_id,prestador_id' }
        )
        .select('id')
        .single()

      const chatId: string | null = (!convErr && convData) ? convData.id : null

      // 3. Notify prestador
      await supabase.from('notificacoes').insert({
        user_id:   cand.prestador_id,
        tipo:      'proposta_aceita',
        titulo:    'Proposta aceita! 🎉',
        subtitulo: post.title,
        link:      chatId ? `/chat/${chatId}` : `/bico/${postId}`,
        lida:      false,
      })

      // 4. Update local state + guarda chatId para o botão de fallback
      setCandidaturas(prev =>
        prev.map(c => c.id === cand.id ? { ...c, status: 'aceita' } : c)
      )
      if (chatId) setOpenChatId(chatId)

      // 5. Redirect direto
      if (chatId) {
        router.push(`/chat/${chatId}`)
        return
      } else {
        // Mostra erro com detalhes reais para diagnóstico
        setAcceptErr(
          convErr
            ? `Erro ao criar conversa: ${convErr.message} (código: ${convErr.code})`
            : 'Conversa criada mas ID não retornou. Execute o SQL de configuração no Supabase.'
        )
      }

    } catch (e) {
      console.error('Erro ao aceitar proposta:', e)
      setAcceptErr('Erro inesperado. Tente novamente.')
    } finally {
      setAccepting(null)
    }
  }

  /* ── Reject ── */
  async function handleReject(cand: Candidatura) {
    setRemoving(cand.id)
    await supabase.from('candidaturas').update({ status: 'recusada' }).eq('id', cand.id)

    // Remove after animation
    setTimeout(() => {
      setCandidaturas(prev => prev.filter(c => c.id !== cand.id))
      setRemoving(null)
    }, 400)
  }

  /* ── Sort ── */
  const sorted = [...candidaturas].sort((a, b) => {
    if (filter === 'menor_preco') {
      const av = a.valor ?? Infinity; const bv = b.valor ?? Infinity
      if (a.tipo === 'hora' && a.horas_estimadas) {
        const ta = (a.valor ?? Infinity) * a.horas_estimadas
        const tb = b.tipo === 'hora' && b.horas_estimadas ? (b.valor ?? Infinity) * b.horas_estimadas : bv
        return ta - tb
      }
      return av - bv
    }
    if (filter === 'melhor_avaliacao') return (b.profiles.score ?? 0) - (a.profiles.score ?? 0)
    if (filter === 'mais_rapido') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return 0 // 'todas': mantém created_at desc
  })

  const pendentes = candidaturas.filter(c => c.status === 'pendente').length
  const total = candidaturas.length

  /* ── Loading ── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const urgInfo = post?.urgency ? (URGENCY_MAP[post.urgency] ?? URGENCY_MAP.sem_pressa) : URGENCY_MAP.sem_pressa
  const budget = post?.budget_min || post?.budget_max
    ? `R$ ${post.budget_min ? fmt(post.budget_min) : '?'} – R$ ${post.budget_max ? fmt(post.budget_max) : '?'}`
    : 'a combinar'

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: '#0F0F0F', zIndex: 20, borderBottom: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Propostas recebidas</span>
        {total > 0 && (
          <span style={{ backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 12, fontWeight: 800, borderRadius: 20, padding: '3px 10px', minWidth: 28, textAlign: 'center' }}>
            {total}
          </span>
        )}
        {total === 0 && <div style={{ width: 36 }} />}
      </div>

      {/* ─── Error banner ─── */}
      {acceptErr && (
        <div style={{ margin: '10px 16px 0', backgroundColor: '#2a0a0a', border: '1px solid #FF4D6A55', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#FF7A7A', lineHeight: 1.5 }}>{acceptErr}</p>
          </div>
          <button onClick={() => setAcceptErr(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ─── Post summary card ─── */}
      {post && (
        <div style={{ margin: '12px 16px', backgroundColor: '#171717', borderRadius: 12, padding: '12px 14px', border: '1px solid #222' }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{post.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: urgInfo.color, backgroundColor: urgInfo.bg, borderRadius: 6, padding: '2px 8px' }}>
              {urgInfo.label}
            </span>
            <span style={{ fontSize: 11, color: '#555' }}>
              💰 {budget}
            </span>
            {pendentes > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD11A' }}>
                {pendentes} aguardando resposta
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Empty state ─── */}
      {total === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🦆</div>
          <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#fff' }}>Nenhuma proposta ainda</p>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            Compartilhe seu post para receber<br />mais propostas
          </p>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: post?.title ?? 'Bico no Pato AI', url: `${window.location.origin}/post/${postId}` }).catch(() => {})
              }
            }}
            style={{ backgroundColor: '#171717', border: '1px solid #272727', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Compartilhar post
          </button>
        </div>
      ) : (
        <>
          {/* ─── Filters ─── */}
          <div style={{ display: 'flex', gap: 6, padding: '4px 16px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  flexShrink: 0,
                  height: 32,
                  borderRadius: 20,
                  padding: '0 14px',
                  border: `1px solid ${filter === f.key ? '#FFD11A' : '#252525'}`,
                  backgroundColor: filter === f.key ? '#FFD11A' : 'transparent',
                  color: filter === f.key ? '#0F0F0F' : '#666',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ─── Proposal list ─── */}
          <div style={{ paddingBottom: 40 }}>
            {sorted.map((cand, idx) => (
              <ProposalCard
                key={cand.id}
                cand={cand}
                isFirst={idx === 0 && filter === 'todas'}
                onAccept={handleAccept}
                onReject={handleReject}
                accepting={accepting === cand.id}
                removing={removing === cand.id}
                chatId={cand.status === 'aceita' ? openChatId : null}
              />
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
