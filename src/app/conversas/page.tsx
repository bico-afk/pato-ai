'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ─────────────────────────────────────────────── */
interface Conversa {
  id: string
  user1_id: string
  user2_id: string
  status: string
  valor_combinado: number | null
  updated_at: string
  last_message?: string
  other_user?: { id: string; full_name: string | null; avatar_url: string | null; seal: string | null }
  unread?: number
}

/* ─── Helpers ────────────────────────────────────────────── */
function initials(name: string) {
  return (name ?? '')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase() || '?'
}

function sealIcon(seal: string | null) {
  if (seal === 'ouro') return '🥇'
  if (seal === 'prata') return '🥈'
  return '🥉'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function statusLabel(status: string) {
  if (status === 'acordo_fechado') return { label: '🤝 Acordo fechado', color: '#22c55e' }
  if (status === 'encerrada')      return { label: '🔒 Encerrada',       color: '#6b7280' }
  return null
}

/* ─── Bottom Nav ─────────────────────────────────────────── */
function BottomNav({ active }: { active: string }) {
  const router = useRouter()
  const items = [
    { key: 'buscar', icon: '🔍', label: 'Buscar',  path: '/' },
    { key: 'feed',   icon: '📋', label: 'Feed',    path: '/feed' },
    { key: 'criar',  icon: '➕', label: 'Criar',   path: '/criar-pedido' },
    { key: 'chats',  icon: '💬', label: 'Chats',   path: '/conversas' },
    { key: 'perfil', icon: '👤', label: 'Perfil',  path: '/perfil' },
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, background: 'rgba(10,10,10,0.97)',
      backdropFilter: 'blur(16px)', borderTop: '1px solid #1A1A1A',
      display: 'flex', zIndex: 100, padding: '8px 0 20px',
    }}>
      {items.map(it => (
        <button key={it.key} onClick={() => router.push(it.path)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 2, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
          color: active === it.key ? '#FFD11A' : '#666',
          fontSize: 10, fontWeight: active === it.key ? 700 : 400,
        }}>
          <span style={{ fontSize: 20 }}>{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function ConversasPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uid, setUid] = useState('')
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const me = session.user.id
    setUid(me)

    type RawRow = { id: string; user1_id: string; user2_id: string; status: string; valor_combinado: number | null; updated_at: string }
    type RawMsg = { conversa_id: string; content: string; type: string; created_at: string }

    // Fetch conversations where user is participant
    const { data: rows } = await supabase
      .from('conversas')
      .select('id, user1_id, user2_id, status, valor_combinado, updated_at')
      .or(`user1_id.eq.${me},user2_id.eq.${me}`)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (!rows || rows.length === 0) { setLoading(false); return }

    const typedRows = rows as RawRow[]

    // Collect other user IDs
    const otherIds = [...new Set(typedRows.map(r => r.user1_id === me ? r.user2_id : r.user1_id))]

    // Fetch profiles of other users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, seal')
      .in('id', otherIds)

    const profileMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null; seal: string | null }> = {}
    for (const p of profiles ?? []) profileMap[p.id] = p

    // Fetch last message for each conversation
    const convIds = typedRows.map(r => r.id)
    const { data: lastMsgs } = await supabase
      .from('mensagens')
      .select('conversa_id, content, type, created_at')
      .in('conversa_id', convIds)
      .order('created_at', { ascending: false })

    // Build last message map (first occurrence per conversation = latest)
    const lastMsgMap: Record<string, string> = {}
    for (const m of (lastMsgs ?? []) as RawMsg[]) {
      if (!lastMsgMap[m.conversa_id]) {
        lastMsgMap[m.conversa_id] = m.type === 'image' ? '📷 Imagem' : m.type === 'system' ? '🤝 Acordo' : m.content
      }
    }

    const enriched: Conversa[] = typedRows.map(r => {
      const otherId = r.user1_id === me ? r.user2_id : r.user1_id
      return {
        ...r,
        other_user: profileMap[otherId] ?? { id: otherId, full_name: 'Usuário', avatar_url: null, seal: null },
        last_message: lastMsgMap[r.id] ?? 'Iniciar conversa',
      }
    })

    setConversas(enriched)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    load()

    // Realtime: atualiza apenas a conversa afetada (sem refetch total)
    type MsgPayload = { new: { conversa_id: string; content: string; type: string; created_at: string } }
    const channel = supabase.channel('conversas-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens' },
        (payload: MsgPayload) => {
          const msg = payload.new
          setConversas(prev => {
            const idx = prev.findIndex(c => c.id === msg.conversa_id)
            if (idx === -1) {
              // Conversa nova não está na lista — faz reload completo
              load()
              return prev
            }
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              last_message: msg.type === 'image' ? '📷 Imagem' : msg.type === 'system' ? '🤝 Acordo' : msg.content,
              updated_at: msg.created_at,
            }
            // Re-ordena por updated_at
            return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          })
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[conversas] realtime channel error — fazendo reload')
          load()
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1E1E1E', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 480, margin: '0 auto',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Conversas</span>
        {conversas.length > 0 && (
          <span style={{ background: '#FFD11A22', color: '#FFD11A', fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '4px 10px' }}>
            {conversas.length}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && conversas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>💬</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sem conversas ainda</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 28 }}>
              Busque profissionais e inicie uma conversa para fechar um serviço.
            </p>
            <button onClick={() => router.push('/')} style={{
              background: '#FFD11A', color: '#000', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              🔍 Buscar profissionais
            </button>
          </div>
        )}

        {/* Conversation list */}
        {!loading && conversas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {conversas.map((c, i) => {
              const other = c.other_user
              const badge = statusLabel(c.status)
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/chat/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: i < conversas.length - 1 ? '1px solid #1A1A1A' : 'none',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {other?.avatar_url
                        ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 18, fontWeight: 700, color: '#FFD11A' }}>{initials(other?.full_name ?? '')}</span>
                      }
                    </div>
                    {other?.seal && (
                      <div style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14, lineHeight: 1 }}>
                        {sealIcon(other.seal)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {other?.full_name ?? 'Usuário'}
                      </span>
                      <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>{timeAgo(c.updated_at)}</span>
                    </div>

                    {badge ? (
                      <span style={{ fontSize: 12, color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {c.last_message}
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav active="chats" />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
