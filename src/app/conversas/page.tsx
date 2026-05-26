'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'

interface ChatRow {
  id:              string
  client_id:       string | null
  professional_id: string | null
  status:          string
  updated_at:      string
  demand_id:       string | null
  // enriched
  other_user?: { id: string; username: string; full_name: string | null; avatar_url: string | null }
  last_message?: string
  demand_desc?:  string | null
}

const initials = (n: string) => (n ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #0f0f0f' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#111', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, width: '50%', background: '#111', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 11, width: '70%', background: '#0f0f0f', borderRadius: 6 }} />
      </div>
    </div>
  )
}

export default function ConversasPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [chats,    setChats]    = useState<ChatRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth?next=/conversas'); return }

    const { data: userRow } = await supabase
      .from('users').select('id').eq('auth_id', session.user.id).single()
    if (!userRow) { setLoading(false); return }

    const myId = (userRow as Record<string, unknown>).id as string
    setMyUserId(myId)

    const { data: rows } = await supabase
      .from('chats')
      .select('id, client_id, professional_id, status, updated_at, demand_id')
      .or(`client_id.eq.${myId},professional_id.eq.${myId}`)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (!rows || rows.length === 0) { setLoading(false); return }
    const typedRows = rows as unknown as ChatRow[]

    // Collect other user IDs and demand IDs
    const otherIds  = [...new Set(typedRows.map(r => r.client_id === myId ? r.professional_id : r.client_id).filter(Boolean))] as string[]
    const demandIds = [...new Set(typedRows.map(r => r.demand_id).filter(Boolean))] as string[]
    const chatIds   = typedRows.map(r => r.id)

    const [usersRes, demandsRes, msgsRes] = await Promise.all([
      otherIds.length > 0
        ? supabase.from('users').select('id, username, full_name, avatar_url').in('id', otherIds)
        : Promise.resolve({ data: [] }),
      demandIds.length > 0
        ? supabase.from('demands').select('id, description').in('id', demandIds)
        : Promise.resolve({ data: [] }),
      supabase.from('messages')
        .select('chat_id, content, message_type, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false }),
    ])

    type UserItem   = { id: string; username: string; full_name: string | null; avatar_url: string | null }
    type DemandItem = { id: string; description: string }
    type MsgItem    = { chat_id: string; content: string | null; message_type: string; created_at: string }

    const userMap: Record<string, UserItem> = {}
    for (const u of (usersRes.data ?? []) as unknown as UserItem[]) userMap[u.id] = u

    const demandMap: Record<string, string> = {}
    for (const d of (demandsRes.data ?? []) as unknown as DemandItem[]) demandMap[d.id] = d.description

    const lastMsgMap: Record<string, string> = {}
    for (const m of (msgsRes.data ?? []) as unknown as MsgItem[]) {
      if (!lastMsgMap[m.chat_id]) {
        lastMsgMap[m.chat_id] = m.message_type === 'image' ? '📷 Imagem' : m.message_type === 'system' ? '📋 Sistema' : (m.content ?? '')
      }
    }

    const enriched: ChatRow[] = typedRows.map(r => {
      const otherId = r.client_id === myId ? r.professional_id : r.client_id
      return {
        ...r,
        other_user:   otherId ? (userMap[otherId] ?? { id: otherId, username: '@usuário', full_name: null, avatar_url: null }) : undefined,
        last_message: lastMsgMap[r.id] ?? 'Iniciar conversa',
        demand_desc:  r.demand_id ? (demandMap[r.demand_id] ?? null) : null,
      }
    })

    setChats(enriched)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    load()

    const channel = supabase.channel('conversas-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const m = payload.new as { chat_id: string; content: string | null; message_type: string; created_at: string }
          setChats(prev => {
            const idx = prev.findIndex(c => c.id === m.chat_id)
            if (idx === -1) { load(); return prev }
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              last_message: m.message_type === 'image' ? '📷 Imagem' : (m.content ?? ''),
              updated_at:   m.created_at,
            }
            return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          })
        }
      )
      .subscribe((_s: `${REALTIME_SUBSCRIBE_STATES}`) => { /* noop */ })

    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Conversas</h1>
        {chats.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 99, padding: '3px 10px' }}>
            {chats.length}
          </span>
        )}
      </header>

      {loading && (
        <div>
          {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {!loading && chats.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sem conversas ainda</h2>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 28, maxWidth: 280, margin: '0 auto 28px' }}>
            Quando alguém se candidatar ao seu pedido, a conversa aparece aqui.
          </p>
          <Link href="/feed" style={{ height: 44, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '11px 24px' }}>
            Ver pedidos →
          </Link>
        </div>
      )}

      {!loading && chats.length > 0 && (
        <div>
          {chats.map((c, i) => {
            const other = c.other_user
            const isClosed = c.status === 'closed'
            return (
              <button key={c.id} onClick={() => router.push(`/chat/${c.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: i < chats.length - 1 ? '1px solid #0f0f0f' : 'none', textAlign: 'left', width: '100%', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: '#111', border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {other?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 15, fontWeight: 800, color: '#00d4ff' }}>{initials(other?.full_name ?? other?.username ?? '')}</span>
                  }
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {other?.full_name ?? other?.username ?? 'Usuário'}
                    </span>
                    <span style={{ fontSize: 11, color: '#444', flexShrink: 0 }}>{timeAgo(c.updated_at)}</span>
                  </div>
                  {isClosed ? (
                    <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>🔒 Conversa encerrada</span>
                  ) : (
                    <span style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {c.last_message}
                    </span>
                  )}
                </div>

                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )
          })}
        </div>
      )}

      {/* Only show "Ir para perfil" if not accessing from nav */}
      {!loading && myUserId && (
        <div style={{ padding: '24px 20px', borderTop: '1px solid #0f0f0f', marginTop: 8 }}>
          <Link href="/perfil" style={{ fontSize: 13, color: '#444', textDecoration: 'none' }}>
            ← Voltar ao perfil
          </Link>
        </div>
      )}
    </div>
  )
}
