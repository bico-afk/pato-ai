'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { dbg } from '@/components/DebugOverlay'

/* ─── Types ──────────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  seal: string | null
  score: number | null
}

interface ChatRow {
  id: string
  post_id: string
  contratante_id: string
  prestador_id: string
  candidatura_id: string | null
}

interface PostRow {
  id: string
  title: string
  urgency: string | null
  budget_min: number | null
  budget_max: number | null
  status: string
}

interface CandidaturaRow {
  id: string
  valor: number | null
  tipo: string | null
  status: string
}

interface Mensagem {
  id: string
  content: string
  created_at: string
  sender_id: string | null
  remetente_id: string | null   // legacy alias
  tipo: string | null
  type: string | null           // legacy alias
  lida: boolean
  chat_id?: string | null
  conversa_id?: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }

function isSystemMsg(m: Mensagem) {
  const tipo = m.tipo || m.type
  return tipo === 'sistema' || tipo === 'system' || m.content.startsWith('🦆') || m.content.startsWith('📋') || m.content.startsWith('✅')
}

function getSenderId(m: Mensagem) { return m.sender_id || m.remetente_id || '' }

function formatContent(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*([^*]+)\*/)
    return (
      <div key={i} style={{ minHeight: line === '' ? 6 : undefined }}>
        {parts.map((p, j) => j % 2 === 1
          ? <strong key={j} style={{ fontWeight: 800 }}>{p}</strong>
          : <span key={j}>{p}</span>
        )}
      </div>
    )
  })
}

const SEAL_COLOR: Record<string, string> = { ouro: '#FFD11A', prata: '#C0C0C0', bronze: '#CD7F32' }
const SEAL_LABEL: Record<string, string> = { ouro: 'OURO', prata: 'PRATA', bronze: 'BRONZE' }

const URGENCY_MAP: Record<string, { label: string; color: string }> = {
  hoje:       { label: '🔴 Hoje',        color: '#FF4D6A' },
  semana:     { label: '🟠 Esta semana', color: '#FF7A1A' },
  sem_pressa: { label: '⬛ Sem pressa',  color: '#888' },
}

const TIPO_LABEL: Record<string, string> = { fixo: 'Valor fixo', hora: 'Por hora', visita: 'Visita técnica' }

/* ─── Sub-components ─────────────────────────────────────── */
function Avatar({ src, name, size = 38 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function ChatPage() {
  const router   = useRouter()
  const params   = useParams()
  const chatId   = params.id as string
  const supabase = createClient()

  const [chat,        setChat]        = useState<ChatRow | null>(null)
  const [post,        setPost]        = useState<PostRow | null>(null)
  const [candidatura, setCandidatura] = useState<CandidaturaRow | null>(null)
  const [otherUser,   setOtherUser]   = useState<Profile | null>(null)
  const [myProfile,   setMyProfile]   = useState<Profile | null>(null)
  const [mensagens,   setMensagens]   = useState<Mensagem[]>([])
  const [userId,      setUserId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [text,        setText]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [hasContract, setHasContract] = useState(false)
  const [showInfo,    setShowInfo]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [chatTable,   setChatTable]   = useState<'chats' | 'conversas'>('conversas')
  const [msgIdField,  setMsgIdField]  = useState<'chat_id' | 'conversa_id'>('conversa_id')
  const [debugMsg,    setDebugMsg]    = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const userIdRef  = useRef<string | null>(null)
  const chatRef    = useRef<ChatRow | null>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  /* ── Scroll to bottom ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  /* ── Fetch messages ── */
  const fetchMessages = useCallback(async (_idField?: 'chat_id' | 'conversa_id') => {
    const uid = userIdRef.current
    const { data } = await supabase
      .from('mensagens')
      .select('id, content, created_at, sender_id, remetente_id, tipo, type, lida')
      .eq('conversa_id', chatId)
      .order('created_at', { ascending: true })

    if (data) setMensagens(data as Mensagem[])

    // Marca como lida (tenta os dois campos de remetente)
    if (uid) {
      await supabase.from('mensagens')
        .update({ lida: true })
        .eq('conversa_id', chatId)
        .or(`remetente_id.neq.${uid},sender_id.neq.${uid}`)
        .eq('lida', false)
    }
  }, [chatId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Initial load ── */
  useEffect(() => {
    console.log('[ChatPage] useEffect fired, chatId=', chatId)
    dbg('info', `[ChatPage] iniciando carregamento chatId=${chatId}`)

    async function load() {
      try {
        // ── Auth ──────────────────────────────────────────────
        // Tenta getSession() primeiro (lê do localStorage, sem rede)
        const { data: sessData } = await supabase.auth.getSession()
        const sessionUser = sessData?.session?.user ?? null

        // Se sessão local existe, usa diretamente. Senão tenta getUser() (rede)
        let uid: string | null = sessionUser?.id ?? null

        if (!uid) {
          const { data: authData, error: authErr } = await supabase.auth.getUser()
          uid = authData?.user?.id ?? null
          dbg(authErr ? 'error' : 'info', `getUser (fallback): uid=${uid ?? 'null'} err=${authErr?.message ?? 'ok'}`)
        } else {
          dbg('info', `getSession OK: uid=${uid}`)
        }

        console.log('[ChatPage] uid =>', uid)

        if (!uid) {
          // Sem sessão — NÃO redireciona para /login — mostra debug
          const msg = `SEM SESSÃO\nchatId: ${chatId}\n\nSua sessão expirou. Volte e faça login novamente.`
          dbg('error', msg)
          setDebugMsg(msg)
          setLoading(false)
          return
        }
        setUserId(uid)
        userIdRef.current = uid

        // ── Busca conversa ───────────────────────────────────
        dbg('info', `buscando conversas para uid=${uid}`)
        const { data: allConvs, error: convsErr } = await supabase
          .from('conversas')
          .select('id, post_id, contratante_id, prestador_id')
          .or(`contratante_id.eq.${uid},prestador_id.eq.${uid}`)

        console.log('[ChatPage] allConvs =>', allConvs?.length, convsErr?.message)
        dbg(convsErr ? 'error' : 'info',
          convsErr
            ? `conversas query error: ${convsErr.message} (${convsErr.code})`
            : `conversas: ${allConvs?.length ?? 0} linhas | ids: ${allConvs?.map(c=>c.id.slice(0,8)).join(', ')}`
        )

        const conv = allConvs?.find(c => c.id === chatId) ?? null
        console.log('[ChatPage] conv found =>', conv?.id)
        dbg(conv ? 'info' : 'warn', conv ? `conversa encontrada: ${conv.id}` : `conversa NÃO encontrada. chatId=${chatId}`)

        if (!conv) {
          const msg = `CONVERSA NÃO ENCONTRADA\nchatId: ${chatId}\nusuário: ${uid}\nconversas carregadas: ${allConvs?.length ?? 0}\nerro query: ${convsErr?.message ?? 'nenhum'}`
          dbg('error', msg)
          setDebugMsg(msg)
          setLoading(false)
          return
        }

        const chatRow: ChatRow = { ...conv, candidatura_id: null }

        // Auth guard
        if (chatRow.contratante_id !== uid && chatRow.prestador_id !== uid) {
          const msg = `ACESSO NEGADO\ncontratante: ${chatRow.contratante_id}\nprestador: ${chatRow.prestador_id}\nusuário: ${uid}`
          dbg('error', msg)
          setDebugMsg(msg)
          setLoading(false)
          return
        }

        setChat(chatRow)
        chatRef.current = chatRow

        // Load post
        if (chatRow.post_id) {
          const { data: p } = await supabase.from('posts').select('id, title, urgency, budget_min, budget_max, status').eq('id', chatRow.post_id).single()
          if (p) setPost(p as PostRow)
        }

        // Load candidatura (for proposal value)
        if (chatRow.candidatura_id) {
          const { data: cand } = await supabase.from('candidaturas').select('id, valor, tipo, status').eq('id', chatRow.candidatura_id).single()
          if (cand) setCandidatura(cand as CandidaturaRow)
        }

        // Load other user
        const otherId = chatRow.contratante_id === uid ? chatRow.prestador_id : chatRow.contratante_id
        const { data: other } = await supabase.from('profiles').select('id, full_name, avatar_url, seal, score').eq('id', otherId).single()
        if (other) setOtherUser(other as Profile)

        // Load my profile
        const { data: me } = await supabase.from('profiles').select('id, full_name, avatar_url, seal, score').eq('id', uid).single()
        if (me) setMyProfile(me as Profile)

        // Check if contract exists
        const { data: contrato } = await supabase.from('contratos').select('id').eq('chat_id', chatId).maybeSingle()
        if (contrato) setHasContract(true)

        // Fetch messages
        await fetchMessages('conversa_id')
        setLoading(false)
        dbg('info', `chat carregado OK: ${chatId}`)

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[ChatPage] crash:', errMsg)
        dbg('error', `CRASH no chat: ${errMsg}`)
        setDebugMsg(`ERRO INESPERADO\n${errMsg}`)
        setLoading(false)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  /* ── Realtime + polling ── */
  useEffect(() => {
    if (loading) return

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `${msgIdField}=eq.${chatId}` },
        (payload) => {
          const nova = payload.new as Mensagem
          setMensagens(prev => prev.some(m => m.id === nova.id) ? prev : [...prev, nova])
          if (userIdRef.current && getSenderId(nova) !== userIdRef.current) {
            supabase.from('mensagens').update({ lida: true }).eq('id', nova.id)
          }
        }
      )
      .subscribe()

    const poll = setInterval(() => fetchMessages(msgIdField), 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [loading, chatId, msgIdField, fetchMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Send text ── */
  async function send() {
    if (!text.trim() || !userId || sending) return
    const c = chatRef.current
    if (!c) return

    setSending(true)
    const content = text.trim()
    setText('')

    const payload = {
      content,
      sender_id:    userId,   // schema novo
      remetente_id: userId,   // schema legado
      conversa_id:  chatId,   // sempre conversa_id
      tipo: 'texto',
      lida: false,
    }

    const { data, error } = await supabase.from('mensagens').insert(payload).select().single()
    if (!error && data) {
      setMensagens(prev => prev.some(m => m.id === (data as Mensagem).id) ? prev : [...prev, data as Mensagem])

      // Notify other user
      const otherId = c.contratante_id === userId ? c.prestador_id : c.contratante_id
      await supabase.from('notificacoes').insert({
        user_id:   otherId,
        tipo:      'nova_mensagem',
        titulo:    `💬 ${myProfile?.full_name || 'Mensagem nova'}`,
        subtitulo: content.length > 60 ? content.slice(0, 57) + '…' : content,
        link:      `/chat/${chatId}`,
        lida:      false,
      }).then(() => {})
    }
    setSending(false)
  }

  /* ── Send photo ── */
  async function sendPhoto(file: File) {
    if (!userId) return
    const c = chatRef.current
    if (!c) return

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `chat/${chatId}/${Date.now()}.${ext}`

      let url: string | null = null
      for (const bucket of ['chat-media', 'posts-media', 'post-photos']) {
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type })
        if (!upErr) {
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
          url = pub.publicUrl
          break
        }
      }

      if (!url) { setUploading(false); return }

      const payload = {
        content:      url,
        sender_id:    userId,   // schema novo
        remetente_id: userId,   // schema legado
        conversa_id:  chatId,   // sempre conversa_id
        tipo: 'foto',
        lida: false,
      }

      const { data } = await supabase.from('mensagens').insert(payload).select().single()
      if (data) setMensagens(prev => prev.some(m => m.id === (data as Mensagem).id) ? prev : [...prev, data as Mensagem])
    } catch (e) { console.error(e) }
    setUploading(false)
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── Debug error screen (em vez de redirecionar silenciosamente) ── */
  if (debugMsg) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', padding: 24, fontFamily: 'monospace' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#FFD11A', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>← voltar</button>
      <h2 style={{ color: '#FF4D6A', fontSize: 16, marginBottom: 12 }}>🔴 Erro ao abrir chat</h2>
      <pre style={{ color: '#aaa', fontSize: 12, backgroundColor: '#111', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
        {debugMsg}
      </pre>
      <p style={{ color: '#555', fontSize: 11, marginTop: 12 }}>Me envie uma foto desta tela para diagnóstico.</p>
    </div>
  )

  const urgInfo = post?.urgency ? (URGENCY_MAP[post.urgency] ?? URGENCY_MAP.sem_pressa) : null

  return (
    <div style={{ backgroundColor: '#0F0F0F', height: '100dvh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* ─── Header ─── */}
      <div style={{ backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', flexShrink: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', minWidth: 0 }}>
          <Avatar src={otherUser?.avatar_url ?? null} name={otherUser?.full_name ?? null} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {otherUser?.full_name || 'Usuário'}
              </span>
              {otherUser?.seal && (
                <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_COLOR[otherUser.seal], border: `1px solid ${SEAL_COLOR[otherUser.seal]}55`, borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                  {SEAL_LABEL[otherUser.seal]}
                </span>
              )}
            </div>
            {post && <p style={{ margin: 0, fontSize: 10, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📋 {post.title}</p>}
          </div>
        </div>

        <button onClick={() => setShowInfo(s => !s)} style={{ background: 'none', border: 'none', color: showInfo ? '#FFD11A' : '#555', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 18 }}>
          ℹ️
        </button>
      </div>

      {/* ─── Info panel (slidedown) ─── */}
      {showInfo && post && (
        <div style={{ backgroundColor: '#111', borderBottom: '1px solid #1e1e1e', padding: '14px 16px', flexShrink: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#fff' }}>{post.title}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {urgInfo && <span style={{ fontSize: 11, color: urgInfo.color }}>{urgInfo.label}</span>}
            {(post.budget_min || post.budget_max) && (
              <span style={{ fontSize: 11, color: '#888' }}>💰 R$ {fmt(post.budget_min ?? 0)} – R$ {fmt(post.budget_max ?? 0)}</span>
            )}
            {candidatura?.valor && (
              <span style={{ fontSize: 11, color: '#FFD11A', fontWeight: 700 }}>
                Proposta: R$ {fmt(candidatura.valor)} {candidatura.tipo ? `(${TIPO_LABEL[candidatura.tipo] ?? candidatura.tipo})` : ''}
              </span>
            )}
          </div>
          <button onClick={() => post && router.push(`/post/${post.id}`)} style={{ fontSize: 12, color: '#FFD11A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
            Ver bico completo →
          </button>
        </div>
      )}

      {/* ─── Bico banner ─── */}
      {!showInfo && post && (
        <div style={{ flexShrink: 0, padding: '8px 16px 0' }}>
          <div style={{ backgroundColor: '#171717', borderRadius: 12, padding: '10px 14px', border: '1px solid #222', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {candidatura?.valor && (
                  <span style={{ fontSize: 11, color: '#FFD11A', fontWeight: 700 }}>R$ {fmt(candidatura.valor)}</span>
                )}
                {candidatura?.tipo && (
                  <span style={{ fontSize: 10, color: '#666' }}>{TIPO_LABEL[candidatura.tipo] ?? candidatura.tipo}</span>
                )}
                <span style={{ fontSize: 10, color: candidatura?.status === 'aceita' ? '#22C55E' : '#888', fontWeight: 700 }}>
                  {candidatura?.status === 'aceita' ? '✓ Aceita' : candidatura?.status === 'confirmada' ? '✅ Confirmada' : '● Em negociação'}
                </span>
              </div>
            </div>
            <button onClick={() => router.push(`/post/${post.id}`)} style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Ver bico →
            </button>
          </div>
        </div>
      )}

      {/* ─── Messages area ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
        {mensagens.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🦆</div>
            <p style={{ fontSize: 14, color: '#555' }}>Inicie a conversa!</p>
          </div>
        )}

        {mensagens.map((m, i) => {
          const sid      = getSenderId(m)
          const isMine   = sid === userId
          const isSystem = isSystemMsg(m)
          const isPhoto  = (m.tipo || m.type) === 'foto'
          const prev     = mensagens[i - 1]
          const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60000
          const prevSame = prev && getSenderId(prev) === sid && !isSystemMsg(prev)

          return (
            <div key={m.id}>
              {/* Time separator */}
              {showTime && (
                <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                  <span style={{ fontSize: 10, color: '#444', backgroundColor: '#141414', borderRadius: 8, padding: '2px 10px' }}>
                    {formatTime(m.created_at)}
                  </span>
                </div>
              )}

              {/* System message */}
              {isSystem ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                  <div style={{ backgroundColor: '#1e1e1e', borderRadius: 8, padding: '6px 14px', maxWidth: '80%', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>{m.content}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2, alignItems: 'flex-end', gap: 6 }}>
                  {/* Other user avatar (only on first message in group) */}
                  {!isMine && (
                    <div style={{ opacity: prevSame ? 0 : 1, flexShrink: 0 }}>
                      <Avatar src={otherUser?.avatar_url ?? null} name={otherUser?.full_name ?? null} size={28} />
                    </div>
                  )}

                  <div style={{ maxWidth: '74%' }}>
                    {isPhoto ? (
                      <img
                        src={m.content}
                        alt=""
                        style={{ maxWidth: '100%', borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', display: 'block' }}
                      />
                    ) : (
                      <div style={{
                        padding: '10px 13px',
                        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        backgroundColor: isMine ? '#FFD11A' : '#1e1e1e',
                        color: isMine ? '#0F0F0F' : '#e8e8e8',
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}>
                        {formatContent(m.content)}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#444', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                      {timeAgo(m.created_at)}
                      {isMine && m.lida && <span style={{ color: '#FFD11A' }}> ✓✓</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ─── Gerar contrato banner ─── */}
      {!hasContract && mensagens.length > 0 && (
        <div style={{ flexShrink: 0, padding: '0 16px 6px' }}>
          <div style={{ backgroundColor: '#0d1500', border: '1px solid #FFD11A33', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#ccc' }}>Negociação concluída? Gere o contrato agora</p>
            </div>
            <button
              onClick={() => router.push(`/contrato/${chatId}`)}
              style={{ flexShrink: 0, backgroundColor: '#FFD11A', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#0F0F0F', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Gerar contrato ⚡
            </button>
          </div>
        </div>
      )}

      {/* ─── Input bar ─── */}
      <div style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid #1e1e1e', padding: '10px 12px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Attachment button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: 42, height: 42, borderRadius: 12, border: '1.5px solid #272727', backgroundColor: 'transparent', color: uploading ? '#444' : '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}
          >
            {uploading ? (
              <div style={{ width: 16, height: 16, border: '2px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : '📎'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = '' }}
          />

          {/* Text input */}
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Digite uma mensagem..."
            style={{ flex: 1, height: 42, backgroundColor: '#181818', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => (e.target.style.borderColor = '#FFD11A')}
            onBlur={e => (e.target.style.borderColor = '#272727')}
          />

          {/* Send button */}
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            style={{ width: 42, height: 42, borderRadius: 12, border: 'none', backgroundColor: text.trim() ? '#FFD11A' : '#1a1a1a', color: text.trim() ? '#0F0F0F' : '#444', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  )
}
