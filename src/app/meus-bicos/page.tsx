'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Post {
  id: string
  title: string
  category: string | null
  urgency: string | null
  city: string | null
  state: string | null
  status: string
  media_urls: string[] | null
  created_at: string
  /* aggregated */
  propostas: number
  msgs_novas: number
  concluido_at: string | null
  chat_id: string | null
}

type FilterKey = 'todos' | 'aberto' | 'em_andamento' | 'fechado' | 'cancelado'

/* ─── Constants ──────────────────────────────────────────── */
const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  aberto:       { label: 'Aberto',        color: '#22C55E', bg: '#0d2a0d' },
  em_andamento: { label: 'Em andamento',  color: '#FFD11A', bg: '#1a1500' },
  fechado:      { label: 'Concluído',     color: '#888',    bg: '#1e1e1e' },
  cancelado:    { label: 'Cancelado',     color: '#f87171', bg: '#2a0d0d' },
}

const URGENCY_MAP: Record<string, { label: string; color: string }> = {
  hoje:       { label: '🔴 Hoje',        color: '#FF4D6A' },
  semana:     { label: '🟠 Esta semana', color: '#FF7A1A' },
  sem_pressa: { label: '⬛ Sem pressa',  color: '#666' },
}

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'aberto',      label: 'Abertos' },
  { key: 'em_andamento',label: 'Em andamento' },
  { key: 'fechado',     label: 'Concluídos' },
  { key: 'cancelado',   label: 'Cancelados' },
]

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/* ─── Confirm dialog (inline) ───────────────────────────── */
function Confirm({ msg, onOk, onCancel }: { msg: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ backgroundColor: '#1e1e1e', borderRadius: 16, padding: '24px 20px', maxWidth: 320, width: '100%', border: '1px solid #2a2a2a' }}>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: '#fff', lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid #2a2a2a', backgroundColor: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button onClick={onOk} style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', backgroundColor: '#FFD11A', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Dot menu ───────────────────────────────────────────── */
function DotMenu({ post, onAction, onClose }: {
  post: Post
  onAction: (action: string, post: Post) => void
  onClose: () => void
}) {
  const items: { label: string; action: string; color?: string }[] = []
  if (post.status === 'aberto' || post.status === 'em_andamento') {
    items.push({ label: '✏️ Editar post', action: 'editar' })
  }
  if (post.status === 'aberto') {
    items.push({ label: '⏸️ Encerrar recebimento', action: 'encerrar' })
    items.push({ label: '🗑️ Deletar post', action: 'deletar', color: '#f87171' })
  }
  if (post.status === 'em_andamento') {
    items.push({ label: '❌ Cancelar bico', action: 'cancelar', color: '#f87171' })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{ position: 'absolute', right: 0, top: 32, backgroundColor: '#1e1e1e', borderRadius: 12, border: '1px solid #2a2a2a', minWidth: 200, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        {items.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 16px', fontSize: 13, color: '#555' }}>Sem ações disponíveis</p>
        ) : items.map(item => (
          <button
            key={item.action}
            onClick={() => { onAction(item.action, post); onClose() }}
            style={{ display: 'block', width: '100%', padding: '13px 16px', background: 'none', border: 'none', color: item.color ?? '#ccc', fontSize: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid #252525' }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

/* ─── Post Card ──────────────────────────────────────────── */
function PostCard({
  post,
  onAction,
  openMenu,
  menuOpen,
  onMenuOpen,
  onMenuClose,
}: {
  post: Post
  onAction: (action: string, post: Post) => void
  openMenu: string | null
  menuOpen: boolean
  onMenuOpen: () => void
  onMenuClose: () => void
}) {
  const router = useRouter()
  const statusInfo = STATUS_INFO[post.status] ?? STATUS_INFO.aberto
  const urgInfo = post.urgency ? URGENCY_MAP[post.urgency] : null
  const thumb = post.media_urls?.[0]

  return (
    <div
      style={{ backgroundColor: '#171717', borderRadius: 16, padding: 16, border: '1px solid #222', marginBottom: 12 }}
    >
      {/* Top row: title + status + thumb */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/post/${post.id}`)}>
          {/* Status badge */}
          <span style={{ fontSize: 10, fontWeight: 700, color: statusInfo.color, backgroundColor: statusInfo.bg, borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginBottom: 6 }}>
            ● {statusInfo.label}
          </span>
          <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.title}
          </p>
          {/* Category + urgency */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            {post.category && (
              <span style={{ fontSize: 11, color: '#666' }}>{post.category}</span>
            )}
            {urgInfo && (
              <span style={{ fontSize: 11, color: urgInfo.color }}>{urgInfo.label}</span>
            )}
          </div>
          {/* City + date */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {post.city && (
              <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#555"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                {post.city}
              </span>
            )}
            <span style={{ fontSize: 11, color: '#444' }}>{fmtDate(post.created_at)}</span>
          </div>
        </div>

        {/* Thumbnail */}
        {thumb && (
          <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }} onClick={() => router.push(`/post/${post.id}`)}>
            <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
      </div>

      {/* Info row: propostas / msgs / concluído */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {post.propostas > 0 && (
          <span style={{ fontSize: 12, color: '#FFD11A', fontWeight: 700 }}>
            👥 {post.propostas} proposta{post.propostas !== 1 ? 's' : ''}
          </span>
        )}
        {post.msgs_novas > 0 && (
          <span style={{ fontSize: 12, color: '#FF7A1A', fontWeight: 700 }}>
            💬 {post.msgs_novas} mensagem{post.msgs_novas !== 1 ? 'ns' : ''} nova{post.msgs_novas !== 1 ? 's' : ''}
          </span>
        )}
        {post.status === 'fechado' && post.concluido_at && (
          <span style={{ fontSize: 12, color: '#22C55E' }}>
            ✅ Concluído em {fmtDate(post.concluido_at)}
          </span>
        )}
        {post.propostas === 0 && post.msgs_novas === 0 && post.status === 'aberto' && (
          <span style={{ fontSize: 12, color: '#444' }}>Aguardando propostas...</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Ver propostas */}
        {post.status !== 'cancelado' && (
          <button
            onClick={() => router.push(`/propostas/${post.id}`)}
            style={{ flex: 1, height: 38, borderRadius: 10, border: post.propostas > 0 ? 'none' : '1px solid #272727', backgroundColor: post.propostas > 0 ? '#FFD11A' : 'transparent', color: post.propostas > 0 ? '#0F0F0F' : '#666', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {post.propostas > 0 ? `Ver propostas (${post.propostas})` : 'Ver bico'}
          </button>
        )}

        {/* Chat button if in progress */}
        {post.chat_id && post.status === 'em_andamento' && (
          <button
            onClick={() => router.push(`/chat/${post.chat_id}`)}
            style={{ height: 38, borderRadius: 10, border: '1px solid #FFD11A33', backgroundColor: 'transparent', color: '#FFD11A', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '0 14px', fontFamily: 'inherit' }}
          >
            💬
          </button>
        )}

        {/* Dot menu */}
        {post.status !== 'fechado' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); menuOpen ? onMenuClose() : onMenuOpen() }}
              style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #272727', backgroundColor: menuOpen ? '#272727' : 'transparent', color: '#888', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
            >
              ···
            </button>
            {menuOpen && (
              <DotMenu post={post} onAction={onAction} onClose={onMenuClose} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function MeusBicosPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [posts,     setPosts]     = useState<Post[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterKey>('todos')
  const [openMenu,  setOpenMenu]  = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState<{ msg: string; onOk: () => void } | null>(null)
  const userIdRef = useRef<string | null>(null)

  /* ── Load posts with aggregated data ── */
  const load = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return

    const { data: rawPosts } = await supabase
      .from('posts')
      .select('id, title, category, urgency, city, state, status, media_urls, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (!rawPosts?.length) { setPosts([]); setLoading(false); return }

    const ids = rawPosts.map(p => p.id)

    /* Propostas por post */
    const { data: candData } = await supabase
      .from('candidaturas')
      .select('post_id')
      .in('post_id', ids)
      .eq('status', 'pendente')

    const candMap: Record<string, number> = {}
    for (const c of candData ?? []) {
      candMap[c.post_id] = (candMap[c.post_id] ?? 0) + 1
    }

    /* Chats ativos por post */
    let chatMap: Record<string, string> = {}
    for (const table of ['chats', 'conversas']) {
      const { data: chatData } = await supabase
        .from(table)
        .select('id, post_id')
        .in('post_id', ids)
        .eq('contratante_id', uid)
      if (chatData?.length) {
        for (const ch of chatData) {
          if (!chatMap[ch.post_id]) chatMap[ch.post_id] = ch.id
        }
        break
      }
    }

    /* Mensagens não lidas por chat */
    const chatIds = Object.values(chatMap)
    const msgsMap: Record<string, number> = {}

    if (chatIds.length > 0) {
      for (const [field, senderField] of [['chat_id', 'sender_id'], ['conversa_id', 'remetente_id']]) {
        const { data: msgData } = await supabase
          .from('mensagens')
          .select(`${field}, ${senderField}`)
          .in(field, chatIds)
          .neq(senderField, uid)
          .eq('lida', false)
        if (msgData?.length) {
          for (const m of msgData) {
            const cid = (m as unknown as Record<string, string>)[field]
            msgsMap[cid] = (msgsMap[cid] ?? 0) + 1
          }
          break
        }
      }
    }

    /* Map post_id → msgs_novas */
    const postMsgsMap: Record<string, number> = {}
    for (const [postId, chatId] of Object.entries(chatMap)) {
      postMsgsMap[postId] = msgsMap[chatId] ?? 0
    }

    const enriched: Post[] = rawPosts.map(p => ({
      ...(p as Post),
      propostas:    candMap[p.id] ?? 0,
      msgs_novas:   postMsgsMap[p.id] ?? 0,
      concluido_at: null,
      chat_id:      chatMap[p.id] ?? null,
    }))

    setPosts(enriched)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      userIdRef.current = data.user.id
      load()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Actions ── */
  async function handleAction(action: string, post: Post) {
    if (action === 'editar') {
      router.push(`/criar-post?edit=${post.id}`)
      return
    }

    if (action === 'encerrar') {
      setConfirm({
        msg: `Encerrar recebimento de propostas para "${post.title}"? O bico ficará em andamento.`,
        onOk: async () => {
          await supabase.from('posts').update({ status: 'em_andamento' }).eq('id', post.id)
          setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'em_andamento' } : p))
          setConfirm(null)
        },
      })
      return
    }

    if (action === 'cancelar') {
      setConfirm({
        msg: `Cancelar o bico "${post.title}"? Esta ação não pode ser desfeita.`,
        onOk: async () => {
          await supabase.from('posts').update({ status: 'cancelado' }).eq('id', post.id)
          setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'cancelado' } : p))
          setConfirm(null)
        },
      })
      return
    }

    if (action === 'deletar') {
      setConfirm({
        msg: `Deletar permanentemente "${post.title}"? Todas as propostas serão perdidas.`,
        onOk: async () => {
          // Delete related candidaturas first
          await supabase.from('candidaturas').delete().eq('post_id', post.id)
          await supabase.from('posts').delete().eq('id', post.id)
          setPosts(prev => prev.filter(p => p.id !== post.id))
          setConfirm(null)
        },
      })
      return
    }
  }

  /* ── Counts per status ── */
  const counts: Record<string, number> = { todos: posts.length }
  for (const p of posts) {
    counts[p.status] = (counts[p.status] ?? 0) + 1
  }

  /* ── Filtered ── */
  const filtered = filter === 'todos' ? posts : posts.filter(p => p.status === filter)

  /* ── Loading ── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32 }} />
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Meus Bicos</span>
        <button
          onClick={() => router.push('/criar-post')}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 22, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
        >
          +
        </button>
      </div>

      {/* ─── Empty state ─── */}
      {posts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '0 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 64 }}>🦆</div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#fff' }}>Você ainda não postou nenhum bico</p>
            <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>Poste o que você precisa e receba propostas em minutos</p>
          </div>
          <button
            onClick={() => router.push('/criar-post')}
            style={{ height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', padding: '0 28px' }}
          >
            Postar meu primeiro bico 🦆
          </button>
        </div>
      ) : (
        <>
          {/* ─── Filters ─── */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {FILTER_LABELS.map(f => {
              const count = f.key === 'todos' ? counts.todos : (counts[f.key] ?? 0)
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    flexShrink: 0,
                    height: 32,
                    borderRadius: 20,
                    padding: '0 14px',
                    border: `1px solid ${active ? '#FFD11A' : '#252525'}`,
                    backgroundColor: active ? '#FFD11A' : 'transparent',
                    color: active ? '#0F0F0F' : '#666',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label} ({count})
                </button>
              )
            })}
          </div>

          {/* ─── Empty filtered state ─── */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🦆</p>
              <p style={{ fontSize: 15, color: '#555' }}>Nenhum bico neste filtro</p>
            </div>
          ) : (
            /* ─── Post list ─── */
            <div style={{ padding: '4px 16px' }}>
              {filtered.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onAction={handleAction}
                  openMenu={openMenu}
                  menuOpen={openMenu === post.id}
                  onMenuOpen={() => setOpenMenu(post.id)}
                  onMenuClose={() => setOpenMenu(null)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Confirm dialog ─── */}
      {confirm && (
        <Confirm
          msg={confirm.msg}
          onOk={confirm.onOk}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Dismiss menu */}
      {openMenu && <div onClick={() => setOpenMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
