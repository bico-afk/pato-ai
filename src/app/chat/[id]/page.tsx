'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'

interface Message {
  id:           string
  chat_id:      string
  sender_id:    string | null
  content:      string | null
  media_urls:   string[] | null
  message_type: string
  is_read:      boolean
  created_at:   string
}

interface OtherUser {
  id:         string
  username:   string
  full_name:  string | null
  avatar_url: string | null
}

interface ChatInfo {
  id:              string
  client_id:       string | null
  professional_id: string | null
  status:          string
  demand_id:       string | null
}

/* ── Helpers ── */
const initials = (n: string) => (n ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const fmtDay = (d: string) => {
  const t = new Date(d), now = new Date(), yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  if (t.toDateString() === now.toDateString())  return 'Hoje'
  if (t.toDateString() === yest.toDateString()) return 'Ontem'
  return t.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/* ── Bubble ── */
function Bubble({ msg, isMe, other }: { msg: Message; isMe: boolean; other: OtherUser | null }) {
  if (msg.message_type === 'system') return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
      <span style={{ background: '#1a1a1a', color: '#555', fontSize: 12, borderRadius: 99, padding: '3px 12px' }}>{msg.content}</span>
    </div>
  )

  const hasPhoto = msg.message_type === 'image' && msg.media_urls && msg.media_urls.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 7, marginBottom: 8 }}>
      {!isMe && (
        other?.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={other.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #222' }} />
          : <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#00d4ff' }}>{other ? initials(other.full_name ?? other.username) : '?'}</div>
      )}
      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3 }}>
        {hasPhoto && msg.media_urls && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={msg.media_urls[0]} alt="" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />
        )}
        {msg.content && (
          <div style={{ padding: '9px 13px', background: isMe ? '#fff' : '#1a1a1a', color: isMe ? '#000' : '#fff', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' }}>
            {msg.content}
          </div>
        )}
        <span style={{ fontSize: 10, color: '#444' }}>{fmtTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const router   = useRouter()
  const params   = useParams()
  const chatId   = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const supabase = createClient()

  const [myUserId,   setMyUserId]   = useState<string | null>(null)
  const [chat,       setChat]       = useState<ChatInfo | null>(null)
  const [other,      setOther]      = useState<OtherUser | null>(null)
  const [messages,   setMessages]   = useState<Message[]>([])
  const [demandDesc, setDemandDesc] = useState<string | null>(null)
  const [newMsg,     setNewMsg]     = useState('')
  const [sending,    setSending]    = useState(false)
  const [status,     setStatus]     = useState<'loading' | 'error' | 'ok'>('loading')
  const [closing,    setClosing]    = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const channelRef  = useRef<RealtimeChannel | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      // Get users.id
      const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', session.user.id).single()
      if (!userRow) { setStatus('error'); return }
      const myId = (userRow as Record<string, unknown>).id as string
      setMyUserId(myId)

      // Fetch chat
      const { data: chatRow } = await supabase
        .from('chats')
        .select('id, client_id, professional_id, status, demand_id')
        .eq('id', chatId)
        .single()

      if (!chatRow) { setStatus('error'); return }
      const c = chatRow as unknown as ChatInfo
      if (c.client_id !== myId && c.professional_id !== myId) { setStatus('error'); return }
      setChat(c)

      // Get other user id
      const otherId = c.client_id === myId ? c.professional_id : c.client_id

      const [msgsRes, demandRes] = await Promise.all([
        supabase.from('messages')
          .select('id, chat_id, sender_id, content, media_urls, message_type, is_read, created_at')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .limit(100),
        c.demand_id
          ? supabase.from('demands').select('description').eq('id', c.demand_id).single()
          : Promise.resolve({ data: null }),
      ])

      if (msgsRes.data) setMessages(msgsRes.data as unknown as Message[])
      if (demandRes.data) {
        const d = demandRes.data as Record<string, unknown>
        setDemandDesc((d.description as string | null) ?? null)
      }

      // Get other user info
      if (otherId) {
        const { data: otherRow } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url')
          .eq('id', otherId)
          .single()
        if (otherRow) setOther(otherRow as unknown as OtherUser)
      }

      // Mark all as read
      await supabase.from('messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', myId)

      setStatus('ok')

      // Realtime
      channelRef.current = supabase
        .channel(`chat-${chatId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const m = payload.new as unknown as Message
            setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
          }
        )
        .subscribe((_s: `${REALTIME_SUBSCRIBE_STATES}`) => { /* noop */ })
    }

    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [chatId, router, supabase])

  /* ── Close / Encerrar bico ── */
  const closeBico = useCallback(async () => {
    if (!chat || !chat.demand_id || closing) return
    setClosing(true)
    try {
      await Promise.all([
        supabase.from('demands').update({ status: 'closed' }).eq('id', chat.demand_id),
        supabase.from('chats').update({ status: 'closed' }).eq('id', chat.id),
      ])
      setChat(prev => prev ? { ...prev, status: 'closed' } : prev)
    } catch (e) {
      console.error('[close-bico]', e)
    } finally {
      setClosing(false)
    }
  }, [chat, closing, supabase])

  const send = useCallback(async () => {
    const text = newMsg.trim()
    if (!text || sending || !chat || !myUserId) return
    setSending(true)
    setNewMsg('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Optimistic
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, chat_id: chat.id, sender_id: myUserId,
      content: text, media_urls: null, message_type: 'text', is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ chat_id: chat.id, sender_id: myUserId, content: text, message_type: 'text' })
      .select()
      .single()

    if (error || !inserted) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setNewMsg(text)
    } else {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? (inserted as unknown as Message) : m))
    }
    setSending(false)
  }, [newMsg, sending, chat, myUserId, supabase])

  /* ── Loading / Error ── */
  if (status === 'loading') return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #111', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <span style={{ fontSize: 40 }}>💬</span>
      <p style={{ fontSize: 15, fontWeight: 700 }}>Conversa não encontrada</p>
      <button onClick={() => router.back()} style={{ height: 44, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontWeight: 800, cursor: 'pointer', padding: '0 24px', fontSize: 14 }}>← Voltar</button>
    </div>
  )

  /* Group messages by date */
  const grouped: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const d = fmtDay(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  }

  return (
    <div style={{ height: 'calc(100dvh - 52px)', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ flexShrink: 0, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #111', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>

        {other?.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={other.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '1px solid #1e1e1e', flexShrink: 0 }} />
          : <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#00d4ff' }}>
              {other ? initials(other.full_name ?? other.username) : '?'}
            </div>
        }

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other?.full_name ?? other?.username ?? '...'}</p>
          {demandDesc && <p style={{ fontSize: 11, color: '#444', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{demandDesc}</p>}
        </div>

        {chat?.status === 'closed' ? (
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
            Encerrado
          </span>
        ) : myUserId && chat?.client_id === myUserId && (
          <button
            onClick={closeBico}
            disabled={closing}
            title="Encerrar bico"
            style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #333', background: 'none', color: closing ? '#444' : '#888', fontSize: 12, fontWeight: 700, cursor: closing ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => { if (!closing) (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={e => { if (!closing) (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
          >
            {closing ? '...' : 'Encerrar bico'}
          </button>
        )}
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0', maxWidth: 600, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 40 }}>💬</span>
            <p style={{ fontSize: 14, color: '#444', margin: 0 }}>Inicie a conversa!</p>
          </div>
        )}

        {grouped.map(g => (
          <div key={g.date}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
              <div style={{ flex: 1, height: 1, background: '#111' }} />
              <span style={{ fontSize: 11, color: '#333' }}>{g.date}</span>
              <div style={{ flex: 1, height: 1, background: '#111' }} />
            </div>
            {g.msgs.map(m => <Bubble key={m.id} msg={m} isMe={m.sender_id === myUserId} other={other} />)}
          </div>
        ))}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Input bar */}
      {chat?.status !== 'closed' && (
        <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid #111', padding: '10px 16px 20px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '9px 12px', display: 'flex', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={newMsg}
                onChange={e => {
                  setNewMsg(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Mensagem..."
                rows={1}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', overflow: 'hidden' }}
              />
            </div>
            <button onClick={send} disabled={!newMsg.trim() || sending}
              style={{ width: 42, height: 42, borderRadius: 11, border: 'none', flexShrink: 0, background: newMsg.trim() ? '#fff' : '#111', cursor: newMsg.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
              {sending
                ? <span style={{ width: 14, height: 14, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={newMsg.trim() ? '#000' : '#444'} strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::placeholder { color: #444; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
