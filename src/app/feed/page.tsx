'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface Demand {
  id:             string
  created_at:     string
  title:          string
  description:    string | null
  category:       string | null
  city:           string | null
  budget_min:     number | null
  budget_max:     number | null
  urgency:        'hoje' | 'semana' | 'sem_pressa' | null
  photo_url:      string | null
  status:         string
  user_id:        string
  proposals_count: number
}

/* ─── Helpers ─────────────────────────────────────────────── */
function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

function anonymousName(userId: string): string {
  const names = ['Alguém', 'Um cliente', 'Uma pessoa', 'Alguém perto']
  const i = parseInt(userId.slice(-2), 16) % names.length
  return names[i]
}

function urgencyLabel(u: Demand['urgency']) {
  if (u === 'hoje')      return { label: 'Urgente',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (u === 'semana')    return { label: 'Esta semana', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  return                        { label: 'Sem pressa', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
}

const CATEGORY_ICONS: Record<string, string> = {
  pintura:        '🎨', elétrica: '⚡', encanamento: '🔧',
  limpeza:        '🧹', reformas:  '🏗️', 'ar-condicionado': '❄️',
  informática:    '💻', jardim:    '🌿', pets: '🐾',
  beleza:         '✂️', culinária: '🍳', montagem: '🔩',
  aulas:          '📚', fotografia: '📷', design: '🖥️',
}

function categoryIcon(cat: string | null): string {
  if (!cat) return '🛠️'
  const key = Object.keys(CATEGORY_ICONS).find(k => cat.toLowerCase().includes(k))
  return key ? CATEGORY_ICONS[key] : '🛠️'
}

/* ─── Demand Card ─────────────────────────────────────────── */
function DemandCard({ demand, onApply, applying }: { demand: Demand; onApply: () => void; applying?: boolean }) {
  const urg = urgencyLabel(demand.urgency)

  return (
    <div style={{
      background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, overflow: 'hidden',
      transition: 'border-color 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,209,26,0.15)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
    >
      {/* Foto opcional */}
      {demand.photo_url && (
        <img src={demand.photo_url} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
      )}

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3a3a3a, #2a2a2a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#888',
              border: '1px solid #333',
            }}>
              {anonymousName(demand.user_id)[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{anonymousName(demand.user_id)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{timeAgo(demand.created_at)}</div>
            </div>
          </div>

          {demand.urgency && (
            <span style={{ fontSize: 10, fontWeight: 700, color: urg.color, background: urg.bg, borderRadius: 99, padding: '3px 8px' }}>
              {urg.label}
            </span>
          )}
        </div>

        {/* Título */}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ececec', marginBottom: 6, lineHeight: 1.35 }}>
          {demand.title}
        </h3>

        {/* Descrição */}
        {demand.description && (
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.55, marginBottom: 12,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
          }}>
            {demand.description}
          </p>
        )}

        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {demand.category && (
            <span style={{ background: '#333', borderRadius: 99, padding: '3px 10px', fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
              {categoryIcon(demand.category)} {demand.category}
            </span>
          )}
          {demand.city && (
            <span style={{ background: '#333', borderRadius: 99, padding: '3px 10px', fontSize: 11, color: '#aaa' }}>
              📍 {demand.city}
            </span>
          )}
          {(demand.budget_min || demand.budget_max) && (
            <span style={{ background: '#333', borderRadius: 99, padding: '3px 10px', fontSize: 11, color: '#aaa' }}>
              💰 R$ {demand.budget_min ?? '?'}{demand.budget_max ? `–${demand.budget_max}` : '+'}
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#555' }}>
            {demand.proposals_count > 0
              ? `${demand.proposals_count} candidatura${demand.proposals_count > 1 ? 's' : ''}`
              : 'Sem candidaturas ainda'}
          </span>
          <button
            onClick={onApply}
            disabled={applying}
            style={{
              height: 34, borderRadius: 99, border: 'none',
              background: applying ? 'rgba(255,209,26,0.15)' : 'linear-gradient(135deg, #FFD11A, #FF9500)',
              color: applying ? '#888' : '#0a0a0a', fontSize: 13, fontWeight: 700,
              cursor: applying ? 'not-allowed' : 'pointer', padding: '0 18px',
              transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => { if (!applying) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {applying && (
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #555', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            )}
            {applying ? 'Abrindo chat...' : 'Me candidatar →'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Filtro de categoria ─────────────────────────────────── */
const CATEGORY_FILTERS = ['Todos', 'Pintura', 'Elétrica', 'Limpeza', 'Reformas', 'Aulas', 'Informática', 'Outros']

/* ═══════════════════════════════════════════════════════════ */
export default function FeedPage() {
  const router = useRouter()
  const [demands,    setDemands]    = useState<Demand[]>([])
  const [loading,    setLoading]    = useState(true)
  const [catFilter,  setCatFilter]  = useState('Todos')
  const [cityFilter, setCityFilter] = useState('')
  const [mounted,    setMounted]    = useState(false)
  const [meId,       setMeId]       = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setMeId(session.user.id)
      } else {
        // sign in anonymously so apply works
        const { data } = await supabase.auth.signInAnonymously()
        if (data.user) setMeId(data.user.id)
      }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('posts')
      .select('id,created_at,title,description,category,city,budget_min,budget_max,urgency,photo_url,status,user_id,proposals_count')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(40)

    if (catFilter !== 'Todos') q = q.ilike('category', `%${catFilter}%`)
    if (cityFilter.trim())     q = q.ilike('city', `%${cityFilter.trim()}%`)

    const { data } = await q
    setDemands(data ?? [])
    setLoading(false)
  }, [catFilter, cityFilter])

  useEffect(() => { load() }, [load])

  async function handleApply(demand: Demand) {
    if (!meId || applyingId) return

    // Own post → go to pedido page
    if (meId === demand.user_id) {
      router.push(`/pedido/${demand.id}`)
      return
    }

    setApplyingId(demand.id)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      }
      const res  = await fetch('/api/apply', {
        method:  'POST',
        headers: authHeaders,
        body:    JSON.stringify({ postId: demand.id }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Erro desconhecido')
      router.push(`/chat/${json.conversaId}`)
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Erro ao se candidatar'}`, false)
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#212121',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#ececec',
      opacity: mounted ? 1 : 0, transition: 'opacity 0.3s',
    }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(33,33,33,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Image src="/pato-icon.svg" alt="Bikco" width={20} height={20} />
          <span style={{ fontSize: 15, fontWeight: 900 }}>
            bikco<span style={{ color: '#FFD11A' }}>.com</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/meus-pedidos')}
            style={{ height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#aaa', fontSize: 12, cursor: 'pointer', padding: '0 14px' }}>
            Meus pedidos
          </button>
          <button onClick={() => router.push('/criar-pedido')}
            style={{ height: 32, borderRadius: 8, border: 'none', background: '#FFD11A', color: '#0a0a0a', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '0 14px' }}>
            + Publicar pedido
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 60px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>
            Pedidos em aberto 🟡
          </h1>
          <p style={{ fontSize: 14, color: '#555' }}>
            Pessoas que precisam de um profissional agora — candidate-se e feche o bico
          </p>
        </div>

        {/* Filtros */}
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Categorias */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
            {CATEGORY_FILTERS.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{
                  height: 30, borderRadius: 99, border: `1px solid ${catFilter === c ? 'rgba(255,209,26,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: catFilter === c ? 'rgba(255,209,26,0.1)' : '#2a2a2a',
                  color: catFilter === c ? '#FFD11A' : '#666',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px', flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                {c}
              </button>
            ))}
          </div>

          {/* Cidade */}
          <input
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            placeholder="🏙️ Filtrar por cidade…"
            style={{
              height: 36, borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)',
              background: '#2a2a2a', color: '#ececec', fontSize: 13,
              padding: '0 16px', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 28, height: 28, margin: '0 auto 12px', border: '3px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#555' }}>Carregando pedidos…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && demands.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum pedido no momento</p>
            <p style={{ fontSize: 13, color: '#555' }}>Seja o primeiro a publicar uma demanda</p>
          </div>
        )}

        {/* Cards */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {demands.map(d => (
              <DemandCard key={d.id} demand={d} applying={applyingId === d.id} onApply={() => handleApply(d)} />
            ))}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          borderRadius: 99, padding: '10px 24px',
          fontSize: 13, fontWeight: 600, color: '#fff',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
          animation: 'toastIn 0.25s ease', zIndex: 200, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        input::placeholder { color: #444; }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #212121; }
      `}</style>
    </div>
  )
}
