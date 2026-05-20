'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface Profile {
  id: string; full_name: string | null; avatar_url: string | null
  city: string | null; state: string | null
  seal: 'bronze' | 'prata' | 'ouro' | null
}
interface Post {
  id: string; user_id: string; title: string; description: string | null
  category: string | null; city: string | null; state: string | null
  budget_min: number | null; budget_max: number | null
  urgency: string | null; photo_url: string | null; status: string
  created_at: string
  profiles: Profile
  candidaturas: { id: string; status: string }[]
  curtidas:     { id: string; user_id: string }[]
  comentarios:  { id: string }[]
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const PALETTE = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return PALETTE[Math.abs(h) % PALETTE.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `${m}min`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
function hashtags(p: Post): string[] {
  const t: string[] = []
  if (p.category) t.push(p.category.toLowerCase().replace(/\s+/g, ''))
  if (p.urgency === 'hoje') t.push('urgente')
  if (p.city) t.push(p.city.toLowerCase().replace(/\s+/g, ''))
  return t.slice(0, 4)
}
const SEAL_CLR: Record<string, string> = { ouro: '#FFD11A', prata: '#B0B0B0', bronze: '#CD7F32' }

const PAGE = 12

/* ═══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
function IcBell()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function IcPin()      { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IcHeart({ f }: { f?: boolean }) { return <svg width="17" height="17" viewBox="0 0 24 24" fill={f ? '#E74C3C' : 'none'} stroke={f ? '#E74C3C' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> }
function IcMsg()      { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IcShare()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> }
function IcPlus()     { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function IcSearch()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function IcHome()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IcUser()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> }
function IcBookmark() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> }
function IcChevron()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg> }
function IcDots()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg> }
function IcTrash()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
function IcBolt()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="#888"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }

/* ─── Conta fotos armazenadas no campo photo_url ─── */
function photoCount(photoUrl: string | null): number {
  if (!photoUrl) return 0
  try { const a = JSON.parse(photoUrl); return Array.isArray(a) ? a.length : 1 } catch { return 1 }
}

/* ─── Avatar ─── */
function Avatar({ src, name, size = 38 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  const n = name || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   URGENCY BADGE
══════════════════════════════════════════════════════════════ */
function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency || urgency === 'sem_pressa') return (
    urgency === 'sem_pressa'
      ? <span style={{ fontSize: 11, fontWeight: 700, color: '#555', backgroundColor: '#1a1a1a', borderRadius: 20, padding: '3px 9px' }}>sem pressa</span>
      : null
  )
  if (urgency === 'hoje') return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: '#FF4D6A', borderRadius: 20, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block' }} />
      hoje
    </span>
  )
  if (urgency === 'essa_semana') return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: '#FF7A1A', borderRadius: 20, padding: '3px 9px' }}>
      essa semana
    </span>
  )
  return null
}

type Tab = 'voce' | 'seguindo' | 'bairro' | 'urgentes'
const NAV_H = 64

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function FeedPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [posts,      setPosts]      = useState<Post[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadingMore,setLoadingMore]= useState(false)
  const [hasMore,    setHasMore]    = useState(true)
  const [tab,        setTab]        = useState<Tab>('voce')
  const [notifCount, setNotifCount] = useState(0)
  const [msgCount,   setMsgCount]   = useState(0)
  const [likedIds,   setLikedIds]   = useState<Set<string>>(new Set())
  const [menuOpen,   setMenuOpen]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [urgentCount,setUrgentCount]= useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [newBanner,  setNewBanner]  = useState(false) // "novos posts disponíveis"
  const [catFilter,  setCatFilter]  = useState('')    // '' = todos

  const offsetRef   = useRef(0)
  const tabRef      = useRef<Tab>('voce')
  const catRef      = useRef('')
  const profileRef  = useRef<Profile | null>(null)
  const userIdRef   = useRef<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const touchStart  = useRef(0)
  const scrollRef   = useRef<HTMLDivElement>(null)

  /* ── Build query ── */
  const buildQuery = useCallback((currentTab: Tab, prof: Profile | null, from: number, to: number, cat?: string) => {
    let q = supabase
      .from('posts')
      .select('id,user_id,title,description,category,city,state,budget_min,budget_max,urgency,photo_url,status,created_at,profiles(id,full_name,avatar_url,city,state,seal),candidaturas(id,status),curtidas(id,user_id),comentarios(id)')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (currentTab === 'urgentes') q = q.eq('urgency', 'hoje')
    if (currentTab === 'bairro' && prof?.city) q = q.ilike('city', `%${prof.city}%`)
    const activeCat = cat !== undefined ? cat : catRef.current
    if (activeCat) q = q.eq('category', activeCat)
    return q
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load initial ── */
  const loadFeed = useCallback(async (uid: string, currentTab: Tab, prof: Profile | null, reset = true) => {
    if (reset) { setPosts([]); offsetRef.current = 0; setHasMore(true) }
    const { data } = await buildQuery(currentTab, prof, 0, PAGE - 1)
    if (!data) return
    const newPosts = data as unknown as Post[]
    setPosts(newPosts)
    offsetRef.current = newPosts.length
    setHasMore(newPosts.length === PAGE)
    // Sync liked set
    const liked = new Set<string>()
    newPosts.forEach(p => { if (p.curtidas.some(c => c.user_id === uid)) liked.add(p.id) })
    setLikedIds(liked)
  }, [buildQuery])

  /* ── Load more (infinite scroll) ── */
  const loadMore = useCallback(async () => {
    const uid  = userIdRef.current
    const prof = profileRef.current
    if (!uid || loadingMore || !hasMore) return
    setLoadingMore(true)
    const from = offsetRef.current
    const to   = from + PAGE - 1
    const { data } = await buildQuery(tabRef.current, prof, from, to)
    if (data && data.length > 0) {
      const more = data as unknown as Post[]
      setPosts(prev => {
        const ids = new Set(prev.map(p => p.id))
        return [...prev, ...more.filter(p => !ids.has(p.id))]
      })
      offsetRef.current += more.length
      setHasMore(more.length === PAGE)
      // Update liked
      setLikedIds(prev => {
        const next = new Set(prev)
        more.forEach(p => { if (p.curtidas.some(c => c.user_id === uid)) next.add(p.id) })
        return next
      })
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [buildQuery, loadingMore, hasMore])

  /* ── Init ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const uid = data.user.id
      setUserId(uid)
      userIdRef.current = uid

      const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (!p?.city) { router.push('/onboarding'); return }

      const prof = p as unknown as Profile
      setProfile(prof)
      profileRef.current = prof

      // Notif & msg counts
      supabase.from('notificacoes').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('lida', false)
        .then(({ count }) => setNotifCount(count ?? 0))

      supabase.from('conversas').select('id')
        .or(`contratante_id.eq.${uid},prestador_id.eq.${uid}`)
        .then(async ({ data: convs }) => {
          if (!convs?.length) return
          const { count } = await supabase.from('mensagens')
            .select('id', { count: 'exact', head: true })
            .in('conversa_id', convs.map(c => c.id)).eq('lida', false).neq('remetente_id', uid)
          setMsgCount(count ?? 0)
        })

      // Urgent count
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .eq('urgency', 'hoje').eq('status', 'aberto')
        .then(({ count }) => setUrgentCount(count ?? 0))

      await loadFeed(uid, 'voce', prof)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Tab change ── */
  useEffect(() => {
    tabRef.current = tab
    const uid  = userIdRef.current
    const prof = profileRef.current
    if (uid && !loading) loadFeed(uid, tab, prof)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Category filter change ── */
  useEffect(() => {
    catRef.current = catFilter
    const uid  = userIdRef.current
    const prof = profileRef.current
    if (uid && !loading) loadFeed(uid, tabRef.current, prof)
  }, [catFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime: new posts ── */
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        setNewBanner(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Infinite scroll via IntersectionObserver ── */
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore()
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  /* ── Pull to refresh ── */
  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientY }
  async function onTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientY - touchStart.current
    const el   = scrollRef.current
    if (diff > 80 && el && el.scrollTop < 10) {
      setRefreshing(true)
      const uid  = userIdRef.current
      const prof = profileRef.current
      if (uid) await loadFeed(uid, tabRef.current, prof)
      setNewBanner(false)
      setRefreshing(false)
    }
  }

  /* ── Like toggle ── */
  async function toggleLike(postId: string) {
    const uid = userIdRef.current
    if (!uid) return
    const isLiked = likedIds.has(postId)
    setLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(postId) : n.add(postId); return n })
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      return { ...p, curtidas: isLiked ? p.curtidas.filter(c => c.user_id !== uid) : [...p.curtidas, { id: 'tmp', user_id: uid }] }
    }))
    if (isLiked) await supabase.from('curtidas').delete().eq('post_id', postId).eq('user_id', uid)
    else await supabase.from('curtidas').insert({ post_id: postId, user_id: uid })
  }

  /* ── Delete post ── */
  async function deletePost(postId: string) {
    setDeleting(postId)
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (!error) setPosts(prev => prev.filter(p => p.id !== postId))
    setDeleting(null); setConfirmDel(null); setMenuOpen(null)
  }

  /* ═══════════════════════════════════════════════════════
     POST CARD
  ════════════════════════════════════════════════════════ */
  function PostCard({ p }: { p: Post }) {
    const liked    = likedIds.has(p.id)
    const isOwn    = p.user_id === userId
    const isClosed = p.status === 'fechado' || p.status === 'concluido'
    const props    = p.candidaturas.length
    const pending  = p.candidaturas.filter(c => c.status === 'pendente').length
    const tags     = hashtags(p)

    return (
      <div
        style={{ backgroundColor: '#171717', borderRadius: 16, padding: '14px 16px', margin: '0 12px 8px' }}
        onClick={() => setMenuOpen(null)}
      >
        {/* ─ Header do card ─ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => router.push(`/usuario/${p.user_id}`)}>
            <Avatar src={p.profiles?.avatar_url} name={p.profiles?.full_name} size={40} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{ fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer' }}
                onClick={() => router.push(`/usuario/${p.user_id}`)}
              >
                {p.profiles?.full_name || 'Usuário'}
              </span>
              {p.profiles?.seal && (
                <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_CLR[p.profiles.seal], border: `1px solid ${SEAL_CLR[p.profiles.seal]}55`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>
                  {p.profiles.seal.toUpperCase()}
                </span>
              )}
              <span style={{ color: '#444', fontSize: 12 }}>·</span>
              <span style={{ color: '#444', fontSize: 12 }}>{timeAgo(p.created_at)}</span>
            </div>
            {(p.city || p.profiles?.city) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#555', fontSize: 12, marginTop: 2 }}>
                <IcPin />{p.city || p.profiles?.city}
              </div>
            )}
          </div>
          {/* Menu ⋯ */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', padding: 4, display: 'flex', borderRadius: 6 }}
            >
              <IcDots />
            </button>
            {menuOpen === p.id && (
              <div style={{ position: 'absolute', right: 0, top: 30, backgroundColor: '#202020', border: '1px solid #2a2a2a', borderRadius: 12, padding: 4, zIndex: 60, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                <button onClick={() => { router.push(`/post/${p.id}`); setMenuOpen(null) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', borderRadius: 8 }}>
                  👁️ Ver post
                </button>
                {isOwn && (
                  <button onClick={() => { setConfirmDel(p.id); setMenuOpen(null) }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: '#f87171', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcTrash /> Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─ Confirmar exclusão ─ */}
        {confirmDel === p.id && (
          <div style={{ backgroundColor: '#1f0808', border: '1px solid #5c1a1a', borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#f87171', fontWeight: 600 }}>Excluir este bico?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDel(null)} style={{ height: 30, borderRadius: 6, border: '1px solid #333', backgroundColor: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', padding: '0 10px' }}>Não</button>
              <button onClick={() => deletePost(p.id)} disabled={deleting === p.id} style={{ height: 30, borderRadius: 6, border: 'none', backgroundColor: '#E74C3C', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '0 12px' }}>
                {deleting === p.id ? '…' : 'Sim'}
              </button>
            </div>
          </div>
        )}

        {/* ─ Categoria ─ */}
        {p.category && (
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#FFD11A', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{p.category}</p>
        )}

        {/* ─ Título ─ */}
        <p
          onClick={() => router.push(`/post/${p.id}`)}
          style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.25, cursor: 'pointer', letterSpacing: '-0.3px' }}
        >
          {p.title}
        </p>

        {/* ─ Descrição ─ */}
        {p.description && (
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#777', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.description}
          </p>
        )}

        {/* ─ Ver completo ─ */}
        <button
          onClick={() => router.push(`/post/${p.id}`)}
          style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '0 0 10px', display: 'block' }}
        >
          ver post completo →
        </button>

        {/* ─ Info badges ─ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(p.budget_min || p.budget_max) && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FFD11A', backgroundColor: '#1a1500', borderRadius: 20, padding: '4px 10px' }}>
              💰 R$ {p.budget_min ?? '?'}–{p.budget_max ?? '?'}
            </span>
          )}
          <UrgencyBadge urgency={p.urgency} />
          {props > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#777', backgroundColor: '#1e1e1e', borderRadius: 20, padding: '4px 10px' }}>
              👥 {props} proposta{props > 1 ? 's' : ''}
            </span>
          )}
          {p.photo_url && (() => { const n = photoCount(p.photo_url); return (
            <span
              onClick={() => router.push(`/post/${p.id}`)}
              style={{ fontSize: 12, fontWeight: 600, color: '#888', backgroundColor: '#1e1e1e', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              📷 {n} foto{n > 1 ? 's' : ''}
            </span>
          )})()}
          {isClosed && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', backgroundColor: '#0d2a0d', borderRadius: 20, padding: '4px 10px' }}>
              🔒 fechado
            </span>
          )}
        </div>

        {/* ─ Hashtags ─ */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {tags.map(t => <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#3A3A3A' }}>#{t}</span>)}
          </div>
        )}

        {/* ─ Divisor ─ */}
        <div style={{ height: 1, backgroundColor: '#222', margin: '4px 0 10px' }} />

        {/* ─ Ações ─ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => toggleLike(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: liked ? '#E74C3C' : '#555', padding: 0, fontSize: 14, fontWeight: liked ? 700 : 400, transition: 'all 0.15s' }}>
            <IcHeart f={liked} />{p.curtidas.length > 0 && <span style={{ fontSize: 13 }}>{p.curtidas.length}</span>}
          </button>
          <button onClick={() => router.push(`/post/${p.id}#comentarios`)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, fontSize: 13 }}>
            <IcMsg />{p.comentarios.length > 0 && p.comentarios.length}
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, fontSize: 13 }}>
            <IcShare />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#444', fontSize: 12, marginLeft: 2 }}>
            <IcBolt />{props}
          </div>

          {/* CTA — para não-donos */}
          {!isOwn && !isClosed && (
            <button
              onClick={() => router.push(`/post/${p.id}`)}
              style={{ marginLeft: 'auto', height: 34, borderRadius: 20, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '0 14px', flexShrink: 0, transition: 'opacity 0.15s' }}
            >
              tenho interesse 🦆
            </button>
          )}

          {/* CTA — para donos */}
          {isOwn && !isClosed && (
            <button
              onClick={() => router.push(`/propostas/${p.id}`)}
              style={{ marginLeft: 'auto', height: 34, borderRadius: 20, border: 'none', backgroundColor: pending > 0 ? '#FFD11A' : '#1e1e1e', color: pending > 0 ? '#0F0F0F' : '#666', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '0 14px', flexShrink: 0 }}
            >
              {pending > 0 ? `⚡ ${pending} nova${pending > 1 ? 's' : ''}` : 'ver propostas'}
            </button>
          )}
          {isOwn && isClosed && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22C55E', fontWeight: 700 }}>✅ fechado</span>
          )}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════
     SEGUINDO placeholder
  ════════════════════════════════════════════════════════ */
  function SeguindoEmpty() {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🤝</div>
        <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Ninguém seguido ainda</p>
        <p style={{ fontSize: 14, color: '#555' }}>Explore o feed e siga pessoas para ver os posts delas aqui.</p>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}
      onClick={() => { setMenuOpen(null) }}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 100, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
            <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              pato<span style={{ color: '#FFD11A' }}>.ai</span>
            </span>
          </div>

          {/* Localização central */}
          {profile?.city && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a1a', border: '1px solid #252525', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', color: '#aaa', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              <IcPin />{profile.city}<IcChevron />
            </button>
          )}

          {/* Direita: sino + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/notificacoes')} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0, display: 'flex' }}>
              <IcBell />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#E74C3C', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div onClick={() => router.push('/perfil')} style={{ cursor: 'pointer' }}>
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size={30} />
            </div>
          </div>
        </div>

        {/* ── Abas ── */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 4px' }}>
          {([
            { key: 'voce',     label: 'Para você' },
            { key: 'seguindo', label: 'Seguindo' },
            { key: 'bairro',   label: 'Meu bairro' },
            { key: 'urgentes', label: null },
          ] as { key: Tab; label: string | null }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 14px', fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#fff' : '#555',
              borderBottom: `2px solid ${tab === t.key ? '#FFD11A' : 'transparent'}`,
              transition: 'all 0.15s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}>
              {t.key === 'urgentes' ? (
                <>
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#FF4D6A', display: 'block' }} />
                    {tab !== 'urgentes' && urgentCount > 0 && (
                      <span style={{ position: 'absolute', inset: -1, borderRadius: '50%', border: '2px solid #FF4D6A', animation: 'ping 1.5s ease-in-out infinite', opacity: 0.6 }} />
                    )}
                  </span>
                  Urgentes
                  {urgentCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: '#FF4D6A', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                      {urgentCount}
                    </span>
                  )}
                </>
              ) : t.label}
            </button>
          ))}
        </div>

        {/* ── Filtro de categoria ── */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '8px 12px', gap: 7, borderTop: '1px solid #161616' }}>
          {['Todos', 'Elétrica', 'Encanamento', 'Limpeza', 'Reformas', 'Pintura', 'Montagem', 'Mudança', 'Jardim', 'Informática', 'Aulas', 'Beleza', 'Pets', 'Design', 'Culinária', 'Outros'].map(cat => {
            const val = cat === 'Todos' ? '' : cat
            const sel = catFilter === val
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(sel && cat !== 'Todos' ? '' : val)}
                style={{
                  flexShrink: 0, whiteSpace: 'nowrap',
                  height: 30, padding: '0 13px', borderRadius: 20,
                  border: sel ? 'none' : '1px solid #242424',
                  backgroundColor: sel ? '#FFD11A' : '#141414',
                  color: sel ? '#0F0F0F' : '#666',
                  fontSize: 12, fontWeight: sel ? 800 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </header>

      {/* ══ BANNER: novos posts ══ */}
      {newBanner && (
        <div
          onClick={async () => {
            setNewBanner(false)
            const uid = userIdRef.current; const prof = profileRef.current
            if (uid) { setLoading(true); await loadFeed(uid, tabRef.current, prof); setLoading(false) }
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          style={{ position: 'fixed', top: 164, left: '50%', transform: 'translateX(-50%)', zIndex: 90, backgroundColor: '#FFD11A', color: '#0F0F0F', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,209,26,0.4)', animation: 'slideDown 0.3s ease', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ↑ Novos bicos disponíveis
        </div>
      )}

      {/* ══ SCROLL CONTAINER ══ */}
      <div
        ref={scrollRef}
        style={{ paddingTop: 160, paddingBottom: NAV_H + 16 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >

        {/* Pull to refresh indicator */}
        {refreshing && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <div style={{ width: 22, height: 22, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {/* Banner urgentes */}
        {tab === 'urgentes' && !loading && (
          <div style={{ margin: '0 12px 8px', padding: '12px 14px', background: 'linear-gradient(135deg, #2a0d00, #1a0800)', borderRadius: 14, border: '1px solid #FF4D6A33' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#E74C3C', display: 'block' }} />
                <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid #E74C3C', animation: 'ping 1s ease-in-out infinite' }} />
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#FF4D6A', letterSpacing: '0.04em' }}>{urgentCount} BICOS URGENTES · HOJE</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#884433' }}>Quem responde primeiro, pega. 🦆</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : tab === 'seguindo' ? (
          <SeguindoEmpty />
        ) : posts.length === 0 ? (
          /* ── Estado vazio ── */
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <Image src="/pato-icon.svg" alt="pato" width={64} height={64} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
              {tab === 'urgentes' ? 'Nenhum bico urgente no momento' : 'A rede está esperando o primeiro bico 🦆'}
            </p>
            <p style={{ fontSize: 14, color: '#555', margin: '0 0 24px' }}>Seja o primeiro a postar!</p>
            <button
              onClick={() => router.push('/criar-post')}
              style={{ height: 48, borderRadius: 24, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', padding: '0 24px', fontFamily: 'inherit' }}
            >
              Postar um bico agora
            </button>
          </div>
        ) : (
          /* ── Posts ── */
          <>
            {posts.map(p => <PostCard key={p.id} p={p} />)}

            {/* Sentinel para infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <div style={{ width: 24, height: 24, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <p style={{ textAlign: 'center', color: '#333', fontSize: 12, padding: '16px 0 8px' }}>
                🦆 Você chegou ao fim do feed
              </p>
            )}
          </>
        )}
      </div>

      {/* ══ FAB ══ */}
      <button
        onClick={() => router.push('/criar-post')}
        style={{ position: 'fixed', bottom: NAV_H + 16, right: 20, width: 52, height: 52, borderRadius: '50%', border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(255,209,26,0.5)', zIndex: 80 }}
      >
        <IcPlus />
      </button>

      {/* ══ BOTTOM NAV ══ */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, height: NAV_H, backgroundColor: 'rgba(10,10,10,0.98)', backdropFilter: 'blur(14px)', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100 }}>
        <button onClick={() => setTab('voce')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: tab !== 'seguindo' && tab !== 'bairro' && tab !== 'urgentes' ? '#FFD11A' : '#444' }}>
          <IcHome /><span style={{ fontSize: 10, fontWeight: 600 }}>Feed</span>
        </button>
        <button onClick={() => router.push('/buscar')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#444' }}>
          <IcSearch /><span style={{ fontSize: 10, fontWeight: 600 }}>Buscar</span>
        </button>
        <button onClick={() => router.push('/criar-post')} style={{ width: 54, height: 54, borderRadius: '50%', border: 'none', backgroundColor: '#FFD11A', cursor: 'pointer', color: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(255,209,26,0.4)', transform: 'translateY(-8px)', flexShrink: 0 }}>
          <IcPlus />
        </button>
        <button onClick={() => router.push('/conversas')} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#444' }}>
          <IcBookmark />
          {msgCount > 0 && <span style={{ position: 'absolute', top: 0, right: -4, width: 15, height: 15, borderRadius: 8, backgroundColor: '#FFD11A', color: '#000', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{msgCount}</span>}
          <span style={{ fontSize: 10, fontWeight: 600 }}>Msgs</span>
        </button>
        <button onClick={() => router.push('/perfil')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#444' }}>
          <IcUser /><span style={{ fontSize: 10, fontWeight: 600 }}>Perfil</span>
        </button>
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes ping    { 0%,100% { transform: scale(1); opacity: .6 } 50% { transform: scale(1.9); opacity: 0 } }
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-8px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
