'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
type NotifType =
  | 'proposta_recebida'
  | 'proposta_aceita'
  | 'proposta_recusada'
  | 'nova_mensagem'
  | 'contrato_gerado'
  | 'pagamento_liberado'
  | 'nova_avaliacao'
  | 'novo_seguidor'
  | string

interface Notificacao {
  id: string
  user_id: string
  tipo: NotifType
  titulo: string
  subtitulo: string | null
  link: string | null
  lida: boolean
  created_at: string
}

type FilterKey = 'todas' | 'nao_lidas' | 'propostas' | 'chat' | 'pagamentos'

/* ─── Helpers ────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getIcon(tipo: NotifType): string {
  switch (tipo) {
    case 'proposta_recebida': return '🦆'
    case 'proposta_aceita': return '✅'
    case 'proposta_recusada': return '❌'
    case 'nova_mensagem': return '💬'
    case 'contrato_gerado': return '📄'
    case 'pagamento_liberado': return '💰'
    case 'nova_avaliacao': return '⭐'
    case 'novo_seguidor': return '👥'
    default: return '🔔'
  }
}

function filterMatches(n: Notificacao, filter: FilterKey): boolean {
  if (filter === 'todas') return true
  if (filter === 'nao_lidas') return !n.lida
  if (filter === 'propostas') return n.tipo === 'proposta_recebida' || n.tipo === 'proposta_aceita' || n.tipo === 'proposta_recusada'
  if (filter === 'chat') return n.tipo === 'nova_mensagem' || n.tipo === 'contrato_gerado'
  if (filter === 'pagamentos') return n.tipo === 'pagamento_liberado'
  return true
}

/* ─── Page ───────────────────────────────────────────────── */
export default function NotificacoesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notificacao[]>([])
  const [filter, setFilter] = useState<FilterKey>('todas')
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── load ── */
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    userIdRef.current = user.id

    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80)

    setNotifs((data as Notificacao[]) ?? [])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  /* ── realtime ── */
  useEffect(() => {
    const uid = userIdRef.current
    if (!uid) return
    const channel = supabase
      .channel('notifs-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${uid}` },
        (payload) => {
          setNotifs(prev => [payload.new as Notificacao, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${uid}` },
        (payload) => {
          setNotifs(prev => prev.map(n => n.id === (payload.new as Notificacao).id ? payload.new as Notificacao : n))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loading]) // re-subscribe once uid is set

  /* ── auto mark all read after 3s ── */
  useEffect(() => {
    if (loading) return
    markTimerRef.current = setTimeout(() => {
      markAllRead()
    }, 3000)
    return () => {
      if (markTimerRef.current) clearTimeout(markTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  /* ── actions ── */
  async function markAllRead() {
    const uid = userIdRef.current
    if (!uid) return
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('user_id', uid)
      .eq('lida', false)
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
  }

  async function handleClick(n: Notificacao) {
    if (!n.lida) {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, lida: true } : x))
    }
    if (n.link) router.push(n.link)
  }

  /* ── derived ── */
  const unreadCount = notifs.filter(n => !n.lida).length
  const propostasCount = notifs.filter(n => filterMatches(n, 'propostas')).length
  const chatCount = notifs.filter(n => filterMatches(n, 'chat')).length
  const pagamentosCount = notifs.filter(n => filterMatches(n, 'pagamentos')).length

  const visible = notifs.filter(n => filterMatches(n, filter))
  const hasUnread = unreadCount > 0

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0F0F0F',
      fontFamily: 'Inter, sans-serif',
      color: '#fff',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0F0F0F',
        borderBottom: '1px solid #1E1E1E',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 22,
            cursor: 'pointer',
            padding: '4px 8px 4px 0',
            lineHeight: 1,
          }}
        >←</button>

        <span style={{ fontWeight: 700, fontSize: 18, flex: 1, textAlign: 'center' }}>
          Notificações
        </span>

        {hasUnread ? (
          <button
            onClick={markAllRead}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFD11A',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Marcar todas
          </button>
        ) : (
          <div style={{ width: 80 }} />
        )}
      </div>

      {/* Filtros */}
      <div style={{
        overflowX: 'auto',
        scrollbarWidth: 'none',
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid #1E1E1E',
      }}>
        {([
          { key: 'todas' as FilterKey, label: 'Todas' },
          { key: 'nao_lidas' as FilterKey, label: 'Não lidas', count: unreadCount },
          { key: 'propostas' as FilterKey, label: 'Propostas', count: propostasCount },
          { key: 'chat' as FilterKey, label: 'Chat', count: chatCount },
          { key: 'pagamentos' as FilterKey, label: 'Pagamentos', count: pagamentosCount },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0,
              background: filter === f.key ? '#FFD11A' : '#1E1E1E',
              color: filter === f.key ? '#0F0F0F' : '#aaa',
              border: 'none',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: filter === f.key ? 700 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span style={{
                background: filter === f.key ? '#0F0F0F' : '#FFD11A',
                color: filter === f.key ? '#FFD11A' : '#0F0F0F',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: '16px',
              }}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
          Carregando...
        </div>
      ) : visible.length === 0 ? (
        /* Empty state */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 32px',
          gap: 16,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 56 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
            {filter === 'nao_lidas' ? 'Tudo lido!' : 'Nenhuma notificação ainda'}
          </div>
          <div style={{ color: '#666', fontSize: 14, lineHeight: 1.5, maxWidth: 260 }}>
            {filter === 'nao_lidas'
              ? 'Você está em dia com todas as notificações.'
              : 'Quando algo acontecer na rede você será avisado aqui.'}
          </div>
        </div>
      ) : (
        <div>
          {visible.map((n, idx) => (
            <NotifItem
              key={n.id}
              n={n}
              isLast={idx === visible.length - 1}
              onClick={() => handleClick(n)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── NotifItem ──────────────────────────────────────────── */
function NotifItem({
  n,
  isLast,
  onClick,
}: {
  n: Notificacao
  isLast: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: n.lida ? 'transparent' : '#171717',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid #1A1A1A',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        cursor: n.link ? 'pointer' : 'default',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
    >
      {/* Unread dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: n.lida ? 'transparent' : '#FFD11A',
        marginTop: 6,
        flexShrink: 0,
      }} />

      {/* Icon */}
      <div style={{
        fontSize: 24,
        lineHeight: 1,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {getIcon(n.tipo)}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: n.lida ? 400 : 600,
          color: n.lida ? '#ccc' : '#fff',
          lineHeight: 1.4,
          marginBottom: n.subtitulo ? 4 : 0,
        }}>
          {n.titulo}
        </div>
        {n.subtitulo && (
          <div style={{
            fontSize: 12,
            color: '#666',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {n.subtitulo}
          </div>
        )}
      </div>

      {/* Time */}
      <div style={{
        fontSize: 11,
        color: '#555',
        flexShrink: 0,
        marginTop: 2,
        whiteSpace: 'nowrap',
      }}>
        {timeAgo(n.created_at)}
      </div>
    </button>
  )
}
