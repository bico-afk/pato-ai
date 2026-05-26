'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface Post {
  id:              string
  title:           string
  city:            string | null
  status:          string
  created_at:      string
  candidatos:      number   // count of conversas
}

/* ─── Helpers ─────────────────────────────────────────────── */
function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1)    return 'agora'
  if (m < 60)   return `${m}min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  if (m < 10080) return `${Math.floor(m / 1440)}d`
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function statusStyle(s: string) {
  if (s === 'aberto')    return { label: 'Aberto',       color: '#22C55E', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  }
  if (s === 'concluido') return { label: 'Concluído',    color: '#FFD11A', bg: 'rgba(255,209,26,0.08)', border: 'rgba(255,209,26,0.2)' }
  return                        { label: 'Em andamento', color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' }
}

/* ─── Skeleton ────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ height: 13, width: '60%', borderRadius: 6, background: '#1e1e1e', marginBottom: 10 }} />
      <div style={{ height: 11, width: '35%', borderRadius: 6, background: '#181818' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function MeusPedidosPage() {
  const router = useRouter()

  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [meId,    setMeId]    = useState<string | null>(null)
  const [noAuth,  setNoAuth]  = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        // Try anonymous sign-in (same session the home page uses)
        const { data } = await supabase.auth.signInAnonymously()
        if (!data.user) { setNoAuth(true); setLoading(false); return }
        setMeId(data.user.id)
        fetchPosts(supabase, data.user.id)
      } else {
        setMeId(session.user.id)
        fetchPosts(supabase, session.user.id)
      }
    }

    async function fetchPosts(
      supabase: ReturnType<typeof createClient>,
      uid: string,
    ) {
      /* Posts do usuário */
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('id, title, city, status, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !postsData) { setLoading(false); return }

      /* Contagem de candidatos por pedido */
      const ids = postsData.map(p => p.id)
      let countMap: Record<string, number> = {}

      if (ids.length > 0) {
        const { data: convs } = await supabase
          .from('conversas')
          .select('post_id')
          .in('post_id', ids)

        convs?.forEach(c => {
          countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1
        })
      }

      const enriched: Post[] = postsData.map(p => ({
        ...p,
        candidatos: countMap[p.id] ?? 0,
      }))

      setPosts(enriched)
      setLoading(false)
    }

    load()
  }, [])

  /* ── Render ── */
  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: '#0a0a0a',
      fontFamily: 'Inter, system-ui, sans-serif', color: '#fff',
    }}>

      {/* ══ HEADER ══ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
            </svg>
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>Meus pedidos</h1>
          <button
            onClick={() => router.push('/')}
            style={{
              height: 32, borderRadius: 99, border: 'none',
              background: 'linear-gradient(135deg, #FFD11A, #FF9500)',
              color: '#0a0a0a', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', padding: '0 16px',
            }}
          >
            + Novo pedido
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px' }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} />)}
          </div>
        )}

        {/* No auth */}
        {!loading && noAuth && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Sessão não encontrada</p>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>
              Volte para a home e tente postar novamente
            </p>
            <button
              onClick={() => router.push('/')}
              style={{ height: 44, borderRadius: 99, border: 'none', background: '#FFD11A', color: '#0a0a0a', fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontSize: 14 }}
            >
              Ir para home
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !noAuth && posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhum pedido ainda</p>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 28 }}>
              Poste o que você precisa — alguém vai aparecer
            </p>
            <button
              onClick={() => router.push('/')}
              style={{ height: 44, borderRadius: 99, border: 'none', background: 'linear-gradient(135deg, #FFD11A, #FF9500)', color: '#0a0a0a', fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontSize: 14 }}
            >
              Fazer pedido →
            </button>
          </div>
        )}

        {/* List */}
        {!loading && posts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map(p => <PostRow key={p.id} post={p} onClick={() => router.push(`/pedido/${p.id}`)} />)}
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #0a0a0a; }
      `}</style>
    </div>
  )
}

/* ─── Post Row ────────────────────────────────────────────── */
function PostRow({ post, onClick }: { post: Post; onClick: () => void }) {
  const st = statusStyle(post.status)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#111', border: '1px solid #1a1a1a', borderRadius: 16,
        padding: '16px 18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
    >
      {/* Left — candidatos badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: post.candidatos > 0 ? 'rgba(255,209,26,0.08)' : '#161616',
        border: `1px solid ${post.candidatos > 0 ? 'rgba(255,209,26,0.2)' : '#1e1e1e'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1,
      }}>
        <span style={{ fontSize: 16 }}>{post.candidatos > 0 ? '👤' : '⏳'}</span>
        {post.candidatos > 0 && (
          <span style={{ fontSize: 9, fontWeight: 800, color: '#FFD11A' }}>{post.candidatos}</span>
        )}
      </div>

      {/* Center */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: '#e0e0e0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 5,
        }}>
          {post.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: st.color,
            background: st.bg, border: `1px solid ${st.border}`,
            borderRadius: 99, padding: '2px 8px',
          }}>
            {st.label}
          </span>
          {post.city && (
            <span style={{ fontSize: 11, color: '#444' }}>📍 {post.city}</span>
          )}
          <span style={{ fontSize: 11, color: '#333' }}>{timeAgo(post.created_at)}</span>
        </div>
      </div>

      {/* Right arrow */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </div>
  )
}
