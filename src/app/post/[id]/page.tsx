'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  seal: 'bronze' | 'prata' | 'ouro' | null
  score: number | null
  bio: string | null
}
interface Candidatura {
  id: string
  prestador_id: string
  status: string
  proposta: string | null
  valor: number | null
  tipo_cobranca: 'fixo' | 'hora' | 'visita' | null
  created_at: string
  profiles: Profile
}
interface Post {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  city: string | null
  state: string | null
  budget_min: number | null
  budget_max: number | null
  urgency: string | null
  photo_url: string | null
  status: string
  created_at: string
  profiles: Profile
  candidaturas: Candidatura[]
  curtidas: { id: string; user_id: string }[]
  comentarios: { id: string }[]
}
interface Comentario {
  id: string
  content: string
  created_at: string
  profiles: Profile
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const PALETTE = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return PALETTE[Math.abs(h) % PALETTE.length] }
function initials(n: string)    { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`
  const days = Math.floor(h / 24); if (days < 30) return `há ${days}d`
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
const SEAL_CLR: Record<string, string> = { ouro: '#FFD11A', prata: '#B0B0B0', bronze: '#CD7F32' }
const TIPO_LBL: Record<string, string> = { fixo: '💰 Valor fixo', hora: '⏱️ Por hora', visita: '🔍 Visita técnica' }
const URGENCY: Record<string, { label: string; color: string; bg: string }> = {
  hoje:        { label: '🔴 Hoje — urgente', color: '#FF4D6A', bg: '#2a0511' },
  essa_semana: { label: '🟡 Essa semana',    color: '#FF7A1A', bg: '#1f1100' },
  sem_pressa:  { label: '🟢 Sem pressa',     color: '#22C55E', bg: '#0b1f12' },
  flexivel:    { label: '🟢 Sem pressa',     color: '#22C55E', bg: '#0b1f12' },
}

/* ═══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
function IcArrow()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IcDots()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg> }
function IcPin()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IcHeart({ f }: { f?: boolean }) { return <svg width="19" height="19" viewBox="0 0 24 24" fill={f ? '#E74C3C' : 'none'} stroke={f ? '#E74C3C' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> }
function IcMsg()    { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IcShare()  { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> }
function IcSend()   { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> }
function IcBolt()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="#888"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function IcStar({ filled }: { filled?: boolean }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#FFD11A' : 'none'} stroke="#FFD11A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
function IcCheck()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> }

/* ─── Avatar ─── */
function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  const n = name || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* ─── Stars ─── */
function Stars({ score }: { score: number | null }) {
  const s = Math.min(5, Math.max(0, Math.round(score ?? 0)))
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => <IcStar key={i} filled={i <= s} />)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function PostPage() {
  const router   = useRouter()
  const params   = useParams()
  const postId   = params.id as string
  const supabase = createClient()

  const [post,        setPost]        = useState<Post | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [userId,      setUserId]      = useState<string | null>(null)
  const [liked,       setLiked]       = useState(false)
  const [likeCount,   setLikeCount]   = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [comment,     setComment]     = useState('')
  const [sendingCmt,  setSendingCmt]  = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [concluidos,  setConcluidos]  = useState(0)
  const commentRef = useRef<HTMLDivElement>(null)

  /* ── Load data ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: authData }) => {
      const uid = authData.user?.id ?? null
      setUserId(uid)

      // Load post
      const { data: p } = await supabase
        .from('posts')
        .select(`
          id, user_id, title, description, category, city, state,
          budget_min, budget_max, urgency, photo_url, status, created_at,
          profiles(id, full_name, avatar_url, city, state, seal, score, bio),
          candidaturas(id, prestador_id, status, proposta, valor, tipo_cobranca, created_at, profiles(id, full_name, avatar_url, city, state, seal, score, bio)),
          curtidas(id, user_id),
          comentarios(id)
        `)
        .eq('id', postId)
        .single()

      if (p) {
        const post = p as unknown as Post
        setPost(post)
        setLikeCount(post.curtidas.length)
        if (uid) setLiked(post.curtidas.some(c => c.user_id === uid))

        // Count bicos concluídos do autor
        const { count } = await supabase
          .from('candidaturas')
          .select('id', { count: 'exact', head: true })
          .eq('prestador_id', post.user_id)
          .eq('status', 'confirmada')
        setConcluidos(count ?? 0)
      }

      // Load comentários
      const { data: cmts } = await supabase
        .from('comentarios')
        .select('id, content, created_at, profiles(id, full_name, avatar_url, city, state, seal, score, bio)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (cmts) setComentarios(cmts as unknown as Comentario[])

      setLoading(false)
    })
  }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Like ── */
  async function toggleLike() {
    if (!userId || !post) return
    const isLiked = liked
    setLiked(!isLiked)
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
    if (isLiked) {
      await supabase.from('curtidas').delete().eq('post_id', postId).eq('user_id', userId)
    } else {
      await supabase.from('curtidas').insert({ post_id: postId, user_id: userId })
    }
  }

  /* ── Comentar ── */
  async function sendComment() {
    if (!comment.trim() || !userId || sendingCmt) return
    setSendingCmt(true)
    const content = comment.trim()
    setComment('')
    const { data: newCmt } = await supabase
      .from('comentarios')
      .insert({ post_id: postId, user_id: userId, content })
      .select('id, content, created_at, profiles(id, full_name, avatar_url, city, state, seal, score, bio)')
      .single()
    if (newCmt) setComentarios(prev => [...prev, newCmt as unknown as Comentario])
    setSendingCmt(false)
  }

  /* ── Share ── */
  function share() {
    if (navigator.share) {
      navigator.share({ title: post?.title ?? 'Bico no Pato AI', url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copiado!')
    }
    setMenuOpen(false)
  }

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!post) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 48 }}>🦆</p>
      <p style={{ color: '#555', fontSize: 16 }}>Post não encontrado</p>
      <button onClick={() => router.push('/feed')} style={{ height: 40, borderRadius: 10, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontWeight: 700, cursor: 'pointer', padding: '0 20px', fontFamily: 'inherit' }}>Voltar ao feed</button>
    </div>
  )

  const isOwner   = userId === post.user_id
  const isClosed  = post.status === 'fechado' || post.status === 'concluido'
  const propCount = post.candidaturas.length
  const pendentes = post.candidaturas.filter(c => c.status === 'pendente').length
  const urgInfo   = URGENCY[post.urgency ?? 'sem_pressa'] ?? URGENCY.sem_pressa
  const tags      = [post.category, post.urgency === 'hoje' ? 'urgente' : null, post.city].filter(Boolean) as string[]
  const BTN_H     = 72

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}
      onClick={() => setMenuOpen(false)}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
            <IcArrow /> voltar
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Bico</span>
          {/* Menu ⋯ */}
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', padding: 4 }}>
              <IcDots />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 34, backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, padding: 4, zIndex: 60, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                <button onClick={share} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ccc', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📤 Compartilhar
                </button>
                <button onClick={() => setMenuOpen(false)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#f87171', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🚩 Reportar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ SCROLL CONTENT ══ */}
      <div style={{ paddingBottom: BTN_H + 16 }}>

        {/* ── Perfil do autor ── */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => router.push(`/usuario/${post.user_id}`)}>
              <Avatar src={post.profiles.avatar_url} name={post.profiles.full_name} size={54} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: '#fff', cursor: 'pointer' }}
                  onClick={() => router.push(`/usuario/${post.user_id}`)}
                >
                  {post.profiles.full_name || 'Usuário'}
                </span>
                {post.profiles.seal && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_CLR[post.profiles.seal], border: `1px solid ${SEAL_CLR[post.profiles.seal]}55`, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em' }}>
                    {post.profiles.seal.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Localização e tempo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: '#555', fontSize: 12, marginBottom: 6 }}>
                {(post.profiles.city || post.city) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IcPin />{post.profiles.city || post.city}
                  </span>
                )}
                <span>·</span>
                <span>{timeAgo(post.created_at)}</span>
              </div>

              {/* Avaliação + bicos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Stars score={post.profiles.score} />
                {post.profiles.score && (
                  <span style={{ fontSize: 12, color: '#FFD11A', fontWeight: 700 }}>
                    {post.profiles.score.toFixed(1)}
                  </span>
                )}
                {concluidos > 0 && (
                  <span style={{ fontSize: 12, color: '#555' }}>
                    · {concluidos} bico{concluidos > 1 ? 's' : ''} concluído{concluidos > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Mídia ── */}
        {post.photo_url && (
          <div style={{ margin: '0 16px 0', borderRadius: 12, overflow: 'hidden' }}>
            {post.photo_url.match(/\.(mp4|mov|webm)$/i) ? (
              <video src={post.photo_url} controls playsInline style={{ width: '100%', maxHeight: 280, display: 'block', objectFit: 'cover' }} />
            ) : (
              <img src={post.photo_url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
            )}
          </div>
        )}

        {/* ── Conteúdo ── */}
        <div style={{ padding: '16px 16px 0' }}>
          {post.category && (
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FFD11A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {post.category}
            </p>
          )}
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.25 }}>
            {post.title}
          </h1>
          {post.description && (
            <p style={{ margin: '0 0 12px', fontSize: 15, color: '#888', lineHeight: 1.65 }}>
              {post.description}
            </p>
          )}
          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {tags.map(t => (
                <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>
                  #{t.toLowerCase().replace(/\s+/g, '')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Info card ── */}
        <div style={{ margin: '0 16px 16px', backgroundColor: '#171717', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {/* Orçamento */}
            <div style={{ flex: 1, textAlign: 'center', padding: '4px 8px', borderRight: '1px solid #242424' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#555', fontWeight: 600 }}>💰 Orçamento</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#FFD11A' }}>
                {(post.budget_min || post.budget_max)
                  ? `R$ ${post.budget_min ?? '?'} – ${post.budget_max ?? '?'}`
                  : <span style={{ color: '#444', fontWeight: 500 }}>a combinar</span>
                }
              </p>
            </div>
            {/* Urgência */}
            <div style={{ flex: 1, textAlign: 'center', padding: '4px 8px', borderRight: '1px solid #242424' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#555', fontWeight: 600 }}>⏰ Urgência</p>
              <span style={{ fontSize: 12, fontWeight: 700, color: urgInfo.color, backgroundColor: urgInfo.bg, borderRadius: 20, padding: '3px 8px', display: 'inline-block' }}>
                {urgInfo.label.replace(/^[🔴🟡🟢]\s/, '')}
              </span>
            </div>
            {/* Propostas */}
            <div style={{ flex: 1, textAlign: 'center', padding: '4px 8px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#555', fontWeight: 600 }}>👥 Propostas</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: propCount > 0 ? '#fff' : '#444' }}>
                {propCount}
              </p>
            </div>
          </div>
        </div>

        {/* ── Engajamento ── */}
        <div style={{ margin: '0 16px 16px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }}>
          <button onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: liked ? '#E74C3C' : '#555', padding: 0, fontSize: 14, fontWeight: liked ? 700 : 400, transition: 'all 0.15s' }}>
            <IcHeart f={liked} />{likeCount > 0 && likeCount}
          </button>
          <button onClick={() => commentRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, fontSize: 14 }}>
            <IcMsg />{comentarios.length > 0 && comentarios.length}
          </button>
          <button onClick={share} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, fontSize: 14 }}>
            <IcShare />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#444', fontSize: 13, marginLeft: 2 }}>
            <IcBolt />{propCount}
          </div>
          {isClosed && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#22C55E', backgroundColor: '#0b1f12', borderRadius: 20, padding: '4px 10px' }}>
              🔒 fechado
            </span>
          )}
        </div>

        {/* ══ PROPOSTAS (só para dono) ══ */}
        {isOwner && propCount > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Propostas recebidas ({propCount})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {post.candidaturas.slice(0, 5).map(cand => (
                <div key={cand.id} style={{ backgroundColor: '#171717', borderRadius: 14, padding: '14px 16px', border: cand.status === 'confirmada' ? '1px solid #22C55E44' : '1px solid #242424' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar src={cand.profiles.avatar_url} name={cand.profiles.full_name} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{cand.profiles.full_name || 'Pato'}</span>
                        {cand.profiles.seal && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_CLR[cand.profiles.seal], border: `1px solid ${SEAL_CLR[cand.profiles.seal]}55`, borderRadius: 4, padding: '1px 5px' }}>
                            {cand.profiles.seal.toUpperCase()}
                          </span>
                        )}
                        {cand.status === 'confirmada' && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#22C55E', backgroundColor: '#0b1f12', borderRadius: 4, padding: '2px 6px', marginLeft: 'auto' }}>✓ CONTRATADO</span>
                        )}
                      </div>
                      {cand.tipo_cobranca && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555' }}>{TIPO_LBL[cand.tipo_cobranca]}</p>
                      )}
                    </div>
                    {/* Valor */}
                    {cand.valor && (
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#FFD11A', flexShrink: 0 }}>
                        R$ {cand.valor}
                      </span>
                    )}
                  </div>
                  {/* Proposta preview */}
                  {cand.proposta && (
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#888', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      "{cand.proposta}"
                    </p>
                  )}
                  <button
                    onClick={() => router.push(`/propostas/${post.id}`)}
                    style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #2a2a2a', backgroundColor: 'transparent', color: '#FFD11A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Ver proposta completa →
                  </button>
                </div>
              ))}
              {propCount > 5 && (
                <button onClick={() => router.push(`/propostas/${post.id}`)} style={{ height: 44, borderRadius: 12, border: '1px solid #272727', backgroundColor: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Ver mais {propCount - 5} proposta{propCount - 5 > 1 ? 's' : ''} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ COMENTÁRIOS ══ */}
        <div id="comentarios" ref={commentRef} style={{ padding: '0 16px 16px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#fff' }}>
            Comentários {comentarios.length > 0 && `(${comentarios.length})`}
          </h2>

          {comentarios.length === 0 && (
            <p style={{ color: '#444', fontSize: 14, margin: '0 0 16px' }}>Seja o primeiro a comentar 🦆</p>
          )}

          {comentarios.map(cmt => (
            <div key={cmt.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Avatar src={cmt.profiles.avatar_url} name={cmt.profiles.full_name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ backgroundColor: '#171717', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{cmt.profiles.full_name || 'Usuário'}</span>
                    <span style={{ fontSize: 11, color: '#444' }}>· {timeAgo(cmt.created_at)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.5 }}>{cmt.content}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Input de comentário */}
          {userId && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14, fontWeight: 700 }}>
                  ?
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 8, backgroundColor: '#171717', borderRadius: 14, border: '1.5px solid #272727', padding: '8px 12px', alignItems: 'flex-end' }}
                onFocus={() => {}} >
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                  placeholder="Escreva um comentário…"
                  rows={1}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 80, overflow: 'auto' }}
                />
                <button onClick={sendComment} disabled={!comment.trim() || sendingCmt}
                  style={{ width: 32, height: 32, borderRadius: 10, border: 'none', backgroundColor: comment.trim() ? '#FFD11A' : '#1e1e1e', color: comment.trim() ? '#0F0F0F' : '#444', cursor: comment.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  <IcSend />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ BOTÃO FIXO BOTTOM ══ */}
      {!isClosed && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderTop: '1px solid #1a1a1a', padding: '12px 16px 20px', zIndex: 80 }}>
          {isOwner ? (
            <button
              onClick={() => router.push(`/propostas/${post.id}`)}
              style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {pendentes > 0
                ? `⚡ Ver ${pendentes} proposta${pendentes > 1 ? 's' : ''} nova${pendentes > 1 ? 's' : ''}`
                : `Ver todas as propostas (${propCount})`
              }
            </button>
          ) : (
            <button
              onClick={() => userId ? router.push(`/bico/${post.id}`) : router.push('/login')}
              style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(255,209,26,0.3)' }}
            >
              Tenho interesse 🦆
            </button>
          )}
        </div>
      )}
      {isClosed && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderTop: '1px solid #1a1a1a', padding: '12px 16px 20px', zIndex: 80 }}>
          <div style={{ width: '100%', height: 52, borderRadius: 14, backgroundColor: '#0d2a0d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IcCheck />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#22C55E' }}>Bico fechado — proposta aceita</span>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        textarea { resize: none; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
