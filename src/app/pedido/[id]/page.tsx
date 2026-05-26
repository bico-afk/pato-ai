'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient }         from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface Post {
  id:         string
  title:      string
  city:       string | null
  status:     string
  created_at: string
  user_id:    string
  budget_min: number | null
  budget_max: number | null
}

interface Candidate {
  conversaId:  string
  userId:      string
  fullName:    string
  avatarUrl:   string | null
  skills:      string[]
  city:        string | null
  appliedAt:   string
  lastMessage: string | null
}

/* ─── Helpers ─────────────────────────────────────────────── */
const ADJ  = ['Curioso', 'Rápido', 'Esperto', 'Direto', 'Animado', 'Humilde', 'Veloz', 'Firme']
const NOUN = ['Leão', 'Tigre', 'Águia', 'Lobo', 'Falcão', 'Urso', 'Puma', 'Touro']

function anonName(id: string): string {
  if (!id) return 'Anônimo'
  const b = parseInt(id.replace(/-/g, '').slice(-4), 16) || 0
  return `${ADJ[b % ADJ.length]} ${NOUN[Math.floor(b / ADJ.length) % NOUN.length]}`
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1)    return 'agora'
  if (m < 60)   return `${m}min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

function statusLabel(s: string) {
  if (s === 'aberto')    return { text: 'Aberto',    color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'   }
  if (s === 'concluido') return { text: 'Concluído', color: '#FFD11A', bg: 'rgba(255,209,26,0.08)',  border: 'rgba(255,209,26,0.2)'  }
  return                        { text: 'Em andamento', color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' }
}

/* ═══════════════════════════════════════════════════════════ */
export default function PedidoPage() {
  const router = useRouter()
  const params = useParams()
  const postId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [post,          setPost]          = useState<Post | null>(null)
  const [candidates,    setCandidates]    = useState<Candidate[]>([])
  const [meId,          setMeId]          = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [closingBico,   setClosingBico]   = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setMeId(uid)

      /* 1 — Post */
      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('id, title, city, status, created_at, user_id, budget_min, budget_max')
        .eq('id', postId)
        .single()

      if (postErr || !postData) {
        setError('Pedido não encontrado.')
        setLoading(false)
        return
      }
      setPost(postData as Post)

      /* 2 — Conversations related to this post */
      const { data: conversas, error: convErr } = await supabase
        .from('conversas')
        .select('id, user1_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (convErr) {
        console.error('[pedido] conversas error:', convErr.message)
        setLoading(false)
        return
      }

      if (!conversas || conversas.length === 0) {
        setLoading(false)
        return
      }

      /* 3 — Profiles of candidates (user1 = professional who applied) */
      const professionalIds = conversas.map((c: { user1_id: string }) => c.user1_id)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, skills, city')
        .in('id', professionalIds)

      /* 4 — Last message per conversation (batch query — sem N+1) */
      const convIds = conversas.map((c: { id: string }) => c.id)
      const { data: allMsgs } = await supabase
        .from('mensagens')
        .select('conversa_id, content, created_at')
        .in('conversa_id', convIds)
        .order('created_at', { ascending: false })

      const lastMsgs: Record<string, string> = {}
      for (const m of allMsgs ?? []) {
        if (!lastMsgs[(m as { conversa_id: string }).conversa_id]) {
          lastMsgs[(m as { conversa_id: string }).conversa_id] = (m as { content: string }).content
        }
      }

      /* 5 — Build candidate list */
      const profileMap: Record<string, { full_name: string; avatar_url: string | null; skills: string[]; city: string | null }> = {}
      profiles?.forEach(p => { profileMap[p.id] = p })

      const list: Candidate[] = conversas.map((c: { id: string; user1_id: string; created_at: string }) => {
        const prof  = profileMap[c.user1_id]
        const name  = prof?.full_name ?? anonName(c.user1_id)
        return {
          conversaId:  c.id,
          userId:      c.user1_id,
          fullName:    name,
          avatarUrl:   prof?.avatar_url ?? null,
          skills:      prof?.skills ?? [],
          city:        prof?.city ?? null,
          appliedAt:   c.created_at,
          lastMessage: lastMsgs[c.id] ?? null,
        }
      })

      setCandidates(list)
      setLoading(false)
    }

    load()
  }, [postId])

  /* ── Close bico ── */
  async function handleCloseBico() {
    if (!post || closingBico) return
    setClosingBico(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const authHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      }
      const res  = await fetch('/api/close-bico', {
        method:  'POST',
        headers: authHeaders,
        body:    JSON.stringify({ postId: post.id }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setPost(prev => prev ? { ...prev, status: 'concluido' } : prev)
      showToast('🎉 Bico concluído!')
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Erro'}`, false)
    } finally {
      setClosingBico(false)
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, fontFamily: 'Inter, sans-serif', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{error || 'Pedido não encontrado'}</h2>
        <button onClick={() => router.push('/')} style={{ height: 44, borderRadius: 99, border: 'none', background: '#FFD11A', color: '#0F0F0F', fontWeight: 800, cursor: 'pointer', padding: '0 24px', fontSize: 14 }}>← Voltar</button>
      </div>
    )
  }

  const isOwner = meId === post.user_id
  const status  = statusLabel(post.status)

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>

      {/* ══ HEADER ══ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #1A1A1A',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <button onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Pedido</span>
          </div>
          {/* Status badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, color: status.color,
            background: status.bg, border: `1px solid ${status.border}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {status.text}
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* ══ POST CARD ══ */}
        <div style={{
          background: '#111', border: '1px solid #1E1E1E', borderRadius: 18,
          padding: '22px 20px', marginBottom: 24,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#444', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 12 }}>
            {timeAgo(post.created_at)} atrás · {post.city ?? 'Localização não informada'}
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.4, marginBottom: 12 }}>
            {post.title}
          </h1>

          {(post.budget_min != null || post.budget_max != null) && (
            <p style={{ fontSize: 16, fontWeight: 800, color: '#FFD11A', marginBottom: 16 }}>
              R$ {post.budget_min ?? '?'}{post.budget_max != null ? `–${post.budget_max}` : ''}
            </p>
          )}

          {/* Owner actions */}
          {isOwner && post.status !== 'concluido' && (
            <button
              onClick={handleCloseBico}
              disabled={closingBico}
              style={{
                height: 44, borderRadius: 12, border: 'none',
                background: closingBico ? '#1A1A1A' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: closingBico ? '#444' : '#fff',
                fontSize: 14, fontWeight: 800, cursor: closingBico ? 'not-allowed' : 'pointer',
                padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {closingBico ? (
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : '🎉'}
              {closingBico ? 'Encerrando...' : 'Fechar bico'}
            </button>
          )}

          {post.status === 'concluido' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 12, padding: '10px 16px',
              fontSize: 14, fontWeight: 700, color: '#22C55E',
            }}>
              ✅ Bico concluído!
            </div>
          )}
        </div>

        {/* ══ CANDIDATES ══ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#666', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Candidatos
            </h2>
            {candidates.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#FFD11A',
                background: 'rgba(255,209,26,0.08)', border: '1px solid rgba(255,209,26,0.15)',
                borderRadius: 99, padding: '2px 8px',
              }}>
                {candidates.length}
              </span>
            )}
          </div>

          {candidates.length === 0 ? (
            <div style={{
              background: '#111', border: '1px dashed #1E1E1E', borderRadius: 16,
              padding: '40px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👀</div>
              <p style={{ fontSize: 14, color: '#444', fontWeight: 600, marginBottom: 6 }}>Nenhum candidato ainda</p>
              <p style={{ fontSize: 13, color: '#2a2a2a' }}>Aguarde — profissionais vão se candidatar em breve</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {candidates.map(c => (
                <CandidateCard
                  key={c.conversaId}
                  candidate={c}
                  isOwner={isOwner}
                  onChat={() => router.push(`/chat/${c.conversaId}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ TOAST ══ */}
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
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #0F0F0F; }
      `}</style>
    </div>
  )
}

/* ─── Candidate Card ──────────────────────────────────────── */
function CandidateCard({
  candidate,
  isOwner,
  onChat,
}: {
  candidate: Candidate
  isOwner:   boolean
  onChat:    () => void
}) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1A1A1A', borderRadius: 16,
      padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A1A')}
    >
      {/* Avatar */}
      {candidate.avatarUrl ? (
        <img src={candidate.avatarUrl} alt={candidate.fullName}
          style={{ width: 46, height: 46, borderRadius: 13, objectFit: 'cover', border: '1.5px solid #2A2A2A', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
          border: '1.5px solid #2A2A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#FFD11A',
        }}>
          {initials(candidate.fullName)}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {candidate.fullName}
          </span>
          <span style={{ fontSize: 10, color: '#333', flexShrink: 0 }}>· {timeAgo(candidate.appliedAt)}</span>
        </div>
        {candidate.skills.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {candidate.skills.slice(0, 3).map(s => (
              <span key={s} style={{
                fontSize: 10, fontWeight: 600, color: '#FFD11A',
                background: 'rgba(255,209,26,0.07)', borderRadius: 4, padding: '2px 6px',
              }}>
                {s}
              </span>
            ))}
          </div>
        )}
        {candidate.lastMessage && (
          <p style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            "{candidate.lastMessage}"
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onChat}
        style={{
          height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
          background: isOwner
            ? 'linear-gradient(135deg, #FFD11A, #FF9500)'
            : '#1A1A1A',
          color: isOwner ? '#0F0F0F' : '#666',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '0 14px',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {isOwner ? 'Conversar →' : 'Ver chat →'}
      </button>
    </div>
  )
}
