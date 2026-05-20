'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ── Types ─────────────────────────────────────────────── */
interface Profile {
  id: string; full_name: string | null; avatar_url: string | null
  city: string | null; state: string | null; seal: string | null; type: string | null
}
interface Post {
  id: string; user_id: string; title: string; description: string | null
  category: string | null; city: string | null; state: string | null
  budget_min: number | null; budget_max: number | null
  urgency: string | null; photo_url: string | null; status: string
  created_at: string; disponibilidade: string | null; visibilidade: string | null
  profiles: Profile
  candidaturas: { id: string; prestador_id: string; status: string; proposta: string | null; valor: number | null; profiles: Profile }[]
}
interface Comentario {
  id: string; content: string; created_at: string
  profiles: Profile
}

/* ── Helpers ───────────────────────────────────────────── */
const COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h=0; for(const c of n) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length] }
function initials(n: string) { return (n||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1) return 'agora'; if(m<60) return `há ${m} min`
  const h=Math.floor(m/60); if(h<24) return `há ${h}h`
  return `há ${Math.floor(h/24)}d`
}
const SEAL_COLOR: Record<string,string> = { ouro:'#FFD11A', prata:'#B0B0B0', bronze:'#CD7F32' }
const SEAL_LABEL: Record<string,string> = { ouro:'OURO', prata:'PRATA', bronze:'BRONZE' }

/* ── Icons ─────────────────────────────────────────────── */
function IconArrow() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IconPin() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IconHeart({ filled }: { filled?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#E74C3C' : 'none'} stroke={filled ? '#E74C3C' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> }
function IconMsg() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IconSend() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> }
function IconWallet() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/></svg> }

/* ── Avatar ─────────────────────────────────────────────── */
function Avatar({ profile, size=40 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) return <img src={profile.avatar_url} alt="" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover' }} />
  const n = profile.full_name || '?'
  return <div style={{ width:size, height:size, borderRadius:'50%', backgroundColor:avatarColor(n), display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(n)}</div>
}

/* ── Main ───────────────────────────────────────────────── */
export default function BicoDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const postId   = params.id as string
  const supabase = createClient()

  const [post,       setPost]       = useState<Post | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [userMode,   setUserMode]   = useState<'contratante'|'pato'>('contratante')
  const [userType,   setUserType]   = useState<string | null>(null)
  const [liked,      setLiked]      = useState(false)
  const [likeCount,  setLikeCount]  = useState(0)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [comment,    setComment]    = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [dbError,    setDbError]    = useState<string | null>(null)

  // Proposta form
  const [showForm,            setShowForm]            = useState(false)
  const [proposta,            setProposta]            = useState('')
  const [valor,               setValor]               = useState('')
  const [tipoCobranca,        setTipoCobranca]        = useState<'fixo'|'hora'|'visita'|null>(null)
  const [jaSentou,            setJaSentou]            = useState(false)
  const [enviando,            setEnviando]            = useState(false)
  const [propostaErr,         setPropostaErr]         = useState('')
  const [meuChatId,           setMeuChatId]           = useState<string | null>(null)
  const [minhaCandidaturaId,  setMinhaCandidaturaId]  = useState<string | null>(null)
  const [minhaCandStatus,     setMinhaCandStatus]     = useState<string | null>(null)

  const commentRef = useRef<HTMLTextAreaElement>(null)

  // Polling: verifica status da candidatura e do post a cada 4s
  // Roda enquanto pendente; se virar confirmada, busca o chat e para.
  useEffect(() => {
    if (!minhaCandidaturaId || !postId) return
    if (minhaCandStatus && minhaCandStatus !== 'pendente') return

    const interval = setInterval(async () => {
      // Checar status da candidatura
      const { data: cand } = await supabase
        .from('candidaturas')
        .select('status')
        .eq('id', minhaCandidaturaId)
        .single()

      if (cand?.status && cand.status !== minhaCandStatus) {
        setMinhaCandStatus(cand.status)

        // Se foi contratado → buscar/criar conversa para habilitar botão de chat
        if ((cand.status === 'confirmada' || cand.status === 'aceita') && userId) {
          const { data: conv } = await supabase
            .from('conversas')
            .select('id')
            .eq('post_id', postId)
            .eq('prestador_id', userId)
            .maybeSingle()
          if (conv?.id) setMeuChatId(conv.id)
        }
      }

      // Checar status do post
      const { data: p } = await supabase
        .from('posts')
        .select('status')
        .eq('id', postId)
        .single()

      if (p?.status) {
        setPost(prev => prev ? { ...prev, status: p.status } : prev)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [minhaCandidaturaId, minhaCandStatus, postId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)

      const saved = localStorage.getItem('pato_mode')
      const { data: prof } = await supabase.from('profiles').select('type').eq('id', data.user.id).single()
      const mode = saved === 'pato' || (!saved && prof?.type === 'prestador') ? 'pato' : 'contratante'
      setUserMode(mode)
      setUserType(prof?.type ?? null)

      // Load post
      const { data: p } = await supabase
        .from('posts')
        .select('*, profiles(id, full_name, avatar_url, city, state, seal, type), candidaturas(id, prestador_id, status, proposta, valor, profiles(id, full_name, avatar_url, city, state, seal, type))')
        .eq('id', postId)
        .single()
      if (p) setPost(p as Post)

      // Load likes
      const { count: lc } = await supabase.from('curtidas').select('id', { count: 'exact', head: true }).eq('post_id', postId)
      setLikeCount(lc ?? 0)
      const { data: myLike } = await supabase.from('curtidas').select('id').eq('post_id', postId).eq('user_id', data.user.id).maybeSingle()
      setLiked(!!myLike)

      // Load comments
      const { data: cmts } = await supabase.from('comentarios').select('id, content, created_at, profiles(id, full_name, avatar_url, city, state, seal, type)').eq('post_id', postId).order('created_at', { ascending: true }).limit(50)
      if (cmts) setComentarios(cmts as unknown as Comentario[])

      // Check if already sent proposal
      if (p) {
        const already = (p.candidaturas as {prestador_id:string}[]).some(c => c.prestador_id === data.user.id)
        setJaSentou(already)

        // If already sent, check chat and candidatura status
        if (already) {
          const [{ data: conv }, { data: cand }] = await Promise.all([
            supabase.from('conversas').select('id').eq('post_id', postId).eq('prestador_id', data.user.id).maybeSingle(),
            supabase.from('candidaturas').select('id, status').eq('post_id', postId).eq('prestador_id', data.user.id).maybeSingle(),
          ])
          if (conv) setMeuChatId(conv.id)
          if (cand) {
            setMinhaCandidaturaId(cand.id)
            setMinhaCandStatus(cand.status)
          }
        }
      }

      setLoading(false)
    })
  }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleLike() {
    if (!userId) return
    setDbError(null)
    if (liked) {
      setLiked(false); setLikeCount(v => v - 1)
      const { error } = await supabase.from('curtidas').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) { setLiked(true); setLikeCount(v => v + 1); setDbError('Erro ao descurtir: ' + error.message) }
    } else {
      setLiked(true); setLikeCount(v => v + 1)
      const { error } = await supabase.from('curtidas').insert({ post_id: postId, user_id: userId })
      if (error) { setLiked(false); setLikeCount(v => v - 1); setDbError('Erro ao curtir: ' + error.message) }
    }
  }

  async function sendComment() {
    if (!userId || !comment.trim()) return
    setSendingComment(true); setDbError(null)
    const { data, error } = await supabase.from('comentarios')
      .insert({ post_id: postId, user_id: userId, content: comment.trim() })
      .select('id, content, created_at, profiles(id, full_name, avatar_url, city, state, seal, type)')
      .single()
    if (error) {
      setDbError('Erro ao comentar: ' + error.message)
    } else if (data) {
      setComentarios(prev => [...prev, data as unknown as Comentario])
      setComment('')
    }
    setSendingComment(false)
  }

  async function openChat(prestadorId: string) {
    if (!userId || !post) return
    // Upsert conversa (unique on post_id + prestador_id)
    const { data, error } = await supabase.from('conversas')
      .upsert({ post_id: postId, contratante_id: post.user_id, prestador_id: prestadorId }, { onConflict: 'post_id,prestador_id' })
      .select('id').single()
    if (!error && data) router.push(`/chat/${data.id}`)
  }

  async function sendProposta() {
    if (!userId || !proposta.trim() || !post) return
    setEnviando(true); setPropostaErr('')

    // Get current user's name for notification
    const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
    const myName = myProfile?.full_name || 'Alguém'

    // Tenta inserir com tipo_cobranca; se coluna não existir, tenta sem
    let insertError = null
    const fullPayload = {
      post_id: postId,
      prestador_id: userId,
      proposta: proposta.trim(),
      valor: valor ? parseFloat(valor) : null,
      tipo_cobranca: tipoCobranca,
      status: 'pendente',
    }
    const { error: e1 } = await supabase.from('candidaturas').insert(fullPayload)
    if (e1) {
      // Fallback sem tipo_cobranca
      const { error: e2 } = await supabase.from('candidaturas').insert({
        post_id: postId,
        prestador_id: userId,
        proposta: proposta.trim(),
        valor: valor ? parseFloat(valor) : null,
        status: 'pendente',
      })
      insertError = e2
    }

    if (insertError) {
      if (insertError.code === '23505') setPropostaErr('Você já enviou uma proposta para este bico.')
      else setPropostaErr(insertError.message)
    } else {
      // Notificar dono do post
      if (post.user_id !== userId) {
        await supabase.from('notificacoes').insert({
          user_id: post.user_id,
          tipo: 'proposta_recebida',
          titulo: `${myName} enviou uma proposta para seu bico`,
          subtitulo: post.title,
          link: `/propostas/${postId}`,
          lida: false,
        })
      }
      setJaSentou(true)
      setShowForm(false)
      setTipoCobranca(null)
      setPost(prev => prev ? {
        ...prev,
        candidaturas: [...prev.candidaturas, {
          id: 'new', prestador_id: userId!, status: 'pendente',
          proposta: proposta.trim(), valor: valor ? parseFloat(valor) : null,
          profiles: prev.profiles,
        }],
      } : prev)
    }
    setEnviando(false)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #222', borderTopColor:'#FFD11A', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
        <div style={{ fontSize:56 }}>🦆</div>
        <p style={{ color:'#fff', fontWeight:800, fontSize:18 }}>Bico não encontrado</p>
        <button onClick={() => router.push('/feed')} style={{ color:'#FFD11A', background:'none', border:'none', cursor:'pointer', fontSize:15 }}>← Voltar ao feed</button>
      </div>
    )
  }

  const isOwn = post.user_id === userId
  const isClosed = post.status === 'fechado' || post.status === 'concluido'
    || minhaCandStatus === 'confirmada' // se o prestador foi contratado, trata como fechado
  // Qualquer usuário não-dono pode enviar proposta (sem restrição de type)
  const canApply = !isOwn && !isClosed && !jaSentou
  const proposals = post.candidaturas?.length ?? 0
  const budget = post.budget_min || post.budget_max
    ? `R$ ${post.budget_min ?? '?'}–${post.budget_max ?? '?'}`
    : null

  return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', maxWidth:480, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ position:'sticky', top:0, backgroundColor:'#0F0F0F', zIndex:10, borderBottom:'1px solid #181818', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
          <IconArrow /> voltar
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
          <span style={{ fontSize:16, fontWeight:800, color:'#fff' }}>pato<span style={{ color:'#FFD11A' }}>.ai</span></span>
        </div>
        <div style={{ width:60 }} />
      </div>

      {dbError && (
        <div style={{ margin:'12px 16px 0', padding:'12px 14px', backgroundColor:'#1f0a0a', border:'1.5px solid #5c1a1a', borderRadius:12, color:'#f87171', fontSize:13 }}>
          ⚠️ {dbError}
        </div>
      )}

      <div style={{ padding:'0 0 120px' }}>
        {/* Post */}
        <div style={{ padding:'20px 16px 0' }}>
          {/* Author */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <Avatar profile={post.profiles} size={46} />
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{post.profiles.full_name || 'Usuário'}</span>
                {post.profiles.seal && (
                  <span style={{ fontSize:10, fontWeight:800, color:SEAL_COLOR[post.profiles.seal], border:`1px solid ${SEAL_COLOR[post.profiles.seal]}33`, borderRadius:4, padding:'1px 5px' }}>
                    {SEAL_LABEL[post.profiles.seal]}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:3, color:'#555', fontSize:13, marginTop:3 }}>
                {post.city && <><IconPin />{post.city}{post.state ? `, ${post.state}` : ''} · </>}
                {timeAgo(post.created_at)}
              </div>
            </div>
          </div>

          {/* Category */}
          {post.category && <p style={{ margin:'0 0 6px', fontSize:11, color:'#FFD11A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{post.category}</p>}

          {/* Title */}
          <h1 style={{ margin:'0 0 12px', fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.5px', lineHeight:1.2 }}>{post.title}</h1>

          {/* Description */}
          {post.description && (
            <p style={{ margin:'0 0 16px', fontSize:15, color:'#aaa', lineHeight:1.65 }}>{post.description}</p>
          )}
        </div>

        {/* Photo */}
        {post.photo_url && (
          <div style={{ margin:'0 0 16px' }}>
            <img src={post.photo_url} alt="" style={{ width:'100%', maxHeight:300, objectFit:'cover', display:'block' }} />
          </div>
        )}

        <div style={{ padding:'0 16px' }}>
          {/* Meta chips */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {budget && (
              <span style={{ display:'flex', alignItems:'center', gap:4, backgroundColor:'#1a1a1a', borderRadius:20, padding:'6px 12px', color:'#aaa', fontSize:13 }}>
                <IconWallet />{budget}
              </span>
            )}
            {post.urgency === 'hoje' && <span style={{ backgroundColor:'#FF6B35', color:'#fff', fontSize:12, fontWeight:700, borderRadius:20, padding:'6px 12px' }}>🔴 urgente — hoje</span>}
            {post.urgency === 'essa_semana' && <span style={{ backgroundColor:'#1e1e1e', color:'#aaa', fontSize:12, fontWeight:600, borderRadius:20, padding:'6px 12px' }}>🟡 essa semana</span>}
            {post.urgency === 'flexivel' && <span style={{ backgroundColor:'#1e1e1e', color:'#aaa', fontSize:12, fontWeight:600, borderRadius:20, padding:'6px 12px' }}>🟢 sem pressa</span>}
            {post.disponibilidade && <span style={{ backgroundColor:'#1a1a1a', color:'#888', fontSize:12, borderRadius:20, padding:'6px 12px' }}>🕐 {post.disponibilidade}</span>}
            {post.visibilidade === 'patos_proximos' && <span style={{ backgroundColor:'#0d1a2e', color:'#3B82F6', fontSize:12, borderRadius:20, padding:'6px 12px' }}>📍 só patos próximos</span>}
          </div>

          {/* Bico fechado banner */}
          {isClosed && (
            <div style={{ backgroundColor:'#141414', borderRadius:12, padding:'12px 14px', marginBottom:16, border:'1px solid #22C55E22', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <div>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#22C55E' }}>Bico fechado</p>
                <p style={{ margin:0, fontSize:12, color:'#555' }}>Contrato assinado — não aceita mais propostas</p>
              </div>
            </div>
          )}

          {/* Reactions row */}
          <div style={{ display:'flex', alignItems:'center', gap:18, paddingBottom:16, borderBottom:'1px solid #1e1e1e', marginBottom:16 }}>
            <button onClick={toggleLike} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:liked ? '#E74C3C' : '#555', fontSize:14, padding:0 }}>
              <IconHeart filled={liked} /> {likeCount}
            </button>
            <button onClick={() => commentRef.current?.focus()} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'#555', fontSize:14, padding:0 }}>
              <IconMsg /> {comentarios.length}
            </button>
            <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, color:'#888', fontSize:13, fontWeight:600 }}>
              <span style={{ fontSize:15 }}>⚡</span>
              {proposals} {proposals===1?'proposta':'propostas'}
            </span>
          </div>

          {/* ── Para quem JÁ candidatou (não-dono): banner de status ─── */}
          {!isOwn && jaSentou && (
            <div style={{ marginBottom:18 }}>

              {/* CONTRATADO / CONFIRMADO */}
              {(minhaCandStatus === 'confirmada' || minhaCandStatus === 'aceita' || isClosed) && (
                <div style={{ backgroundColor:'#0d2a0d', border:'2px solid #22C55E55', borderRadius:14, padding:'18px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:36 }}>🎉</span>
                    <div>
                      <p style={{ margin:0, fontSize:15, fontWeight:800, color:'#22C55E' }}>Você foi contratado!</p>
                      <p style={{ margin:'4px 0 0', fontSize:13, color:'#555', lineHeight:1.5 }}>
                        O contratante aceitou sua proposta. O bico foi fechado e está pronto para começar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PENDENTE: aguardando decisão */}
              {(minhaCandStatus === 'pendente' || (!minhaCandStatus && !isClosed)) && (
                <div style={{ backgroundColor:'#141414', border:'1px solid #2a2a2a', borderRadius:14, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:24 }}>⏳</span>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#aaa' }}>Proposta enviada!</p>
                      <p style={{ margin:'3px 0 0', fontSize:13, color:'#555' }}>
                        Aguardando o contratante aceitar sua proposta.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat disponível */}
              {meuChatId && (
                <button
                  onClick={() => router.push(`/chat/${meuChatId}`)}
                  style={{ marginTop:8, width:'100%', height:42, borderRadius:10, border:'none', backgroundColor:'#FFD11A', color:'#0F0F0F', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                >
                  💬 Ver mensagens do contratante
                </button>
              )}
            </div>
          )}

          {/* ── Para quem NÃO candidatou (não-dono, pode candidatar): destaque do contador ─── */}
          {!isOwn && !jaSentou && proposals > 0 && (
            <div style={{ backgroundColor:'#141414', border:'1px solid #2a2a2a', borderRadius:12, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>⚡</span>
              <p style={{ margin:0, fontSize:13, color:'#888' }}>
                <span style={{ color:'#FFD11A', fontWeight:700 }}>{proposals}</span>
                {proposals===1?' pessoa já se candidatou':' pessoas já se candidataram'} a este bico.
              </p>
            </div>
          )}

          {/* ── OWNER: link para página de propostas ─── */}
          {isOwn && (
            <div style={{ marginBottom:24 }}>
              <button
                onClick={() => router.push(`/propostas/${postId}`)}
                style={{ width:'100%', backgroundColor: proposals > 0 ? '#1a1500' : '#141414', border:`1px solid ${proposals > 0 ? '#FFD11A44' : '#2a2a2a'}`, borderRadius:14, padding:'16px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}
              >
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:800, color: proposals > 0 ? '#FFD11A' : '#666' }}>
                    {proposals > 0 ? `⚡ ${proposals} proposta${proposals > 1 ? 's' : ''} recebida${proposals > 1 ? 's' : ''}` : '🦆 Nenhuma proposta ainda'}
                  </p>
                  <p style={{ margin:'3px 0 0', fontSize:12, color:'#555' }}>
                    {proposals > 0 ? 'Ver propostas, comparar e contratar →' : 'Aguarde os patos chegarem →'}
                  </p>
                </div>
                <span style={{ fontSize:20, color:'#FFD11A' }}>›</span>
              </button>
            </div>
          )}

          {/* ── PATO/PRESTADOR: send proposal ─── */}
          {canApply && !jaSentou && (
            <div style={{ marginBottom:24 }}>
              {showForm ? (
                /* Formulário multi-tipo */
                <div style={{ backgroundColor:'#141414', borderRadius:14, border:'1.5px solid #FFD11A44', overflow:'hidden' }}>
                  {/* Header */}
                  <div style={{ backgroundColor:'#1a1500', padding:'12px 16px', borderBottom:'1px solid #2a2a2a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'#FFD11A' }}>🦆 Enviar proposta</span>
                    <button onClick={() => { setShowForm(false); setProposta(''); setValor(''); setTipoCobranca(null) }} style={{ background:'none', border:'none', color:'#555', fontSize:13, cursor:'pointer', padding:0 }}>✕ cancelar</button>
                  </div>
                  <div style={{ padding:'16px' }}>

                    {/* TIPO DE COBRANÇA */}
                    <p style={{ margin:'0 0 10px', fontSize:12, fontWeight:800, color:'#666', textTransform:'uppercase', letterSpacing:'0.07em' }}>Como você quer cobrar?</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:18 }}>
                      {([
                        { key:'fixo',   icon:'💰', label:'Valor\nfixo' },
                        { key:'hora',   icon:'⏱️',  label:'Por\nhora' },
                        { key:'visita', icon:'🔍', label:'Visita\ntécnica' },
                      ] as { key:'fixo'|'hora'|'visita'; icon:string; label:string }[]).map(t => (
                        <button
                          key={t.key}
                          onClick={() => { setTipoCobranca(t.key); setValor('') }}
                          style={{
                            backgroundColor: tipoCobranca === t.key ? '#1a1500' : '#1e1e1e',
                            border: `2px solid ${tipoCobranca === t.key ? '#FFD11A' : '#2a2a2a'}`,
                            borderRadius:12, padding:'14px 8px', cursor:'pointer',
                            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                            transition:'all 0.15s',
                          }}
                        >
                          <span style={{ fontSize:22 }}>{t.icon}</span>
                          <span style={{ fontSize:11, fontWeight:700, color: tipoCobranca === t.key ? '#FFD11A' : '#888', textAlign:'center', lineHeight:1.3, whiteSpace:'pre-line' }}>{t.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Campo de valor — aparece conforme tipo */}
                    {tipoCobranca === 'fixo' && (
                      <div style={{ marginBottom:16 }}>
                        <p style={{ margin:'0 0 6px', fontSize:12, color:'#888', fontWeight:600 }}>Valor fixo pelo serviço</p>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#FFD11A', fontSize:14, fontWeight:800 }}>R$</span>
                          <input
                            autoFocus
                            type="number" value={valor} onChange={e => setValor(e.target.value)}
                            placeholder="0,00"
                            style={{ width:'100%', boxSizing:'border-box', backgroundColor:'#1e1e1e', border:'1.5px solid #FFD11A55', borderRadius:12, color:'#fff', fontSize:16, fontWeight:700, height:52, paddingLeft:44, paddingRight:14, fontFamily:'inherit', outline:'none' }}
                            onFocus={e => e.target.style.borderColor='#FFD11A'}
                            onBlur={e => e.target.style.borderColor='#FFD11A55'}
                          />
                        </div>
                      </div>
                    )}
                    {tipoCobranca === 'hora' && (
                      <div style={{ marginBottom:16 }}>
                        <p style={{ margin:'0 0 6px', fontSize:12, color:'#888', fontWeight:600 }}>Valor por hora</p>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#FFD11A', fontSize:13, fontWeight:800 }}>R$/h</span>
                          <input
                            autoFocus
                            type="number" value={valor} onChange={e => setValor(e.target.value)}
                            placeholder="0,00"
                            style={{ width:'100%', boxSizing:'border-box', backgroundColor:'#1e1e1e', border:'1.5px solid #FFD11A55', borderRadius:12, color:'#fff', fontSize:16, fontWeight:700, height:52, paddingLeft:54, paddingRight:14, fontFamily:'inherit', outline:'none' }}
                            onFocus={e => e.target.style.borderColor='#FFD11A'}
                            onBlur={e => e.target.style.borderColor='#FFD11A55'}
                          />
                        </div>
                      </div>
                    )}
                    {tipoCobranca === 'visita' && (
                      <div style={{ backgroundColor:'#0d1a2e', borderRadius:10, padding:'12px 14px', marginBottom:16, border:'1px solid #1a3a5c' }}>
                        <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:700, color:'#60A5FA' }}>🔍 Visita técnica</p>
                        <p style={{ margin:0, fontSize:12, color:'#555', lineHeight:1.5 }}>Você irá visitar o local antes de dar o orçamento final. O valor aqui é opcional (taxa de visita).</p>
                        <div style={{ position:'relative', marginTop:10 }}>
                          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#60A5FA', fontSize:13, fontWeight:800 }}>R$</span>
                          <input
                            type="number" value={valor} onChange={e => setValor(e.target.value)}
                            placeholder="taxa de visita (opcional)"
                            style={{ width:'100%', boxSizing:'border-box', backgroundColor:'#0a1020', border:'1.5px solid #1a3a5c', borderRadius:12, color:'#fff', fontSize:14, height:46, paddingLeft:40, paddingRight:14, fontFamily:'inherit', outline:'none' }}
                            onFocus={e => e.target.style.borderColor='#60A5FA'}
                            onBlur={e => e.target.style.borderColor='#1a3a5c'}
                          />
                        </div>
                      </div>
                    )}

                    {/* Proposta — aparece após selecionar tipo */}
                    {tipoCobranca && (
                      <>
                        <p style={{ margin:'0 0 6px', fontSize:12, color:'#888', fontWeight:600 }}>Descreva sua experiência e disponibilidade *</p>
                        <textarea
                          autoFocus={tipoCobranca === 'visita'}
                          value={proposta} onChange={e => setProposta(e.target.value)}
                          placeholder="Ex: Tenho 5 anos de experiência, posso ir amanhã de manhã e trarei todos os materiais..."
                          rows={4}
                          style={{ width:'100%', boxSizing:'border-box', backgroundColor:'#1e1e1e', border:`1.5px solid ${proposta.trim() ? '#FFD11A' : '#2a2a2a'}`, borderRadius:12, color:'#fff', fontSize:14, padding:'12px 14px', resize:'none', fontFamily:'inherit', outline:'none', lineHeight:1.6, transition:'border-color 0.15s' }}
                          onFocus={e => e.target.style.borderColor='#FFD11A'}
                          onBlur={e => e.target.style.borderColor = proposta.trim() ? '#FFD11A55' : '#2a2a2a'}
                        />
                        {propostaErr && (
                          <p style={{ margin:'10px 0 0', color:'#f87171', fontSize:13, backgroundColor:'#1f0a0a', padding:'8px 12px', borderRadius:8, border:'1px solid #5c1a1a' }}>
                            ⚠️ {propostaErr}
                          </p>
                        )}
                        <button
                          onClick={sendProposta}
                          disabled={enviando || !proposta.trim()}
                          style={{
                            marginTop:14, width:'100%', height:52, borderRadius:12, border:'none',
                            backgroundColor: proposta.trim() && !enviando ? '#FFD11A' : '#2a2a2a',
                            color: proposta.trim() && !enviando ? '#0F0F0F' : '#555',
                            fontSize:15, fontWeight:800,
                            cursor: proposta.trim() && !enviando ? 'pointer' : 'not-allowed',
                            transition:'all 0.2s',
                          }}>
                          {enviando ? '⏳ Enviando…' : proposta.trim() ? 'Enviar proposta →' : 'Descreva sua proposta acima ↑'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Botão inicial */
                <button
                  onClick={() => setShowForm(true)}
                  style={{ width:'100%', height:56, borderRadius:14, border:'2px solid #FFD11A', backgroundColor:'#FFD11A', color:'#0F0F0F', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(255,209,26,0.25)' }}>
                  🦆 Tenho interesse — enviar proposta
                </button>
              )}
            </div>
          )}

          {/* ── Comments ─── */}
          <div>
            <p style={{ margin:'0 0 14px', fontSize:13, color:'#666', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Comentários ({comentarios.length})
            </p>

            {comentarios.map(c => (
              <div key={c.id} style={{ display:'flex', gap:10, marginBottom:14 }}>
                <Avatar profile={c.profiles} size={32} />
                <div style={{ flex:1, backgroundColor:'#141414', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{c.profiles.full_name || 'Usuário'}</span>
                    <span style={{ fontSize:11, color:'#444' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ margin:0, fontSize:14, color:'#aaa', lineHeight:1.55 }}>{c.content}</p>
                </div>
              </div>
            ))}

            {comentarios.length === 0 && (
              <p style={{ color:'#444', fontSize:14, textAlign:'center', padding:'16px 0' }}>Nenhum comentário ainda. Seja o primeiro!</p>
            )}
          </div>
        </div>
      </div>

      {/* Fixed comment input */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, backgroundColor:'#0a0a0a', borderTop:'1px solid #1e1e1e', padding:'10px 12px 16px', zIndex:50 }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea
            ref={commentRef}
            value={comment} onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            placeholder="Escreva um comentário..."
            rows={1}
            style={{ flex:1, backgroundColor:'#181818', border:'1.5px solid #272727', borderRadius:14, color:'#fff', fontSize:14, padding:'12px 14px', resize:'none', fontFamily:'inherit', outline:'none', lineHeight:1.4, maxHeight:100, overflowY:'auto' }}
            onFocus={e => e.target.style.borderColor='#FFD11A'}
            onBlur={e => e.target.style.borderColor='#272727'}
          />
          <button onClick={sendComment} disabled={sendingComment || !comment.trim()}
            style={{ width:44, height:44, borderRadius:12, border:'none', backgroundColor:comment.trim()?'#FFD11A':'#1a1a1a', color:comment.trim()?'#0F0F0F':'#444', cursor:comment.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  )
}
