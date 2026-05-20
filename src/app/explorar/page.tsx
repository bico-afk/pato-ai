'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Profile {
  id: string; full_name: string | null; avatar_url: string | null
  city: string | null; state: string | null
  seal: 'bronze' | 'prata' | 'ouro' | null
  type: 'contratante' | 'prestador' | 'ambos' | null
}
interface Post {
  id: string; user_id: string; title: string; description: string | null
  category: string | null; city: string | null; state: string | null
  budget_min: number | null; budget_max: number | null
  urgency: string | null; photo_url: string | null; status: string
  created_at: string; profiles: Profile
}
interface Candidatura {
  id: string; post_id: string; status: string; proposta: string | null; valor: number | null
  created_at: string
  posts: { id: string; title: string; city: string | null; category: string | null; status: string; user_id: string; profiles: { full_name: string | null; avatar_url: string | null } } | null
}

/* ── helpers ───────────────────────────────────────────── */
const COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h=0; for(const c of n) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length] }
function initials(n: string) { return (n||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1) return 'agora'; if(m<60) return `há ${m}min`
  const h=Math.floor(m/60); if(h<24) return `há ${h}h`
  return `há ${Math.floor(h/24)}d`
}

/* ── icons ─────────────────────────────────────────────── */
function IconBell()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function IconChat()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IconUser()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> }
function IconSearch() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function IconPin()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IconWallet() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/></svg> }
function IconBriefcase() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> }

/* ── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name, size=34 }: { src?: string|null; name?: string|null; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  const n = name || '?'
  return <div style={{ width:size, height:size, borderRadius:'50%', backgroundColor:avatarColor(n), display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(n)}</div>
}

/* ── Status badge da candidatura ─── */
function CandStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pendente:   { label:'⏳ Aguardando',    color:'#aaa',    bg:'#1e1e1e' },
    aceita:     { label:'🎉 Aceita',        color:'#22C55E', bg:'#0d2a0d' },
    confirmada: { label:'✅ Contratado',    color:'#22C55E', bg:'#0d2a0d' },
    recusada:   { label:'✗ Não escolhido', color:'#555',    bg:'#141414' },
  }
  const s = map[status] ?? map.pendente
  return (
    <span style={{ fontSize:11, fontWeight:700, color:s.color, backgroundColor:s.bg, borderRadius:6, padding:'3px 8px', flexShrink:0 }}>
      {s.label}
    </span>
  )
}

const NAV_H = 64

export default function ExplorarPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [jobs,         setJobs]         = useState<Post[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [loading,      setLoading]      = useState(true)
  const [notifCount,   setNotifCount]   = useState(0)
  const [msgCount,     setMsgCount]     = useState(0)
  const [tab,          setTab]          = useState<'disponíveis'|'propostas'>('disponíveis')

  const loadJobs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, city, state, seal, type)')
      .eq('status', 'aberto')
      .neq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(40)
    setJobs((data as Post[]) ?? [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCandidaturas = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('candidaturas')
      .select('id, post_id, status, proposta, valor, created_at, posts(id, title, city, category, status, user_id, profiles(full_name, avatar_url))')
      .eq('prestador_id', uid)
      .neq('status', 'interesse')
      .order('created_at', { ascending: false })
    setCandidaturas((data as unknown as Candidatura[]) ?? [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setProfile(p as Profile)
        // Contratante puro → redirecionar para feed
        if (p.type === 'contratante') { router.replace('/feed'); return }
      }

      // Notificações
      supabase.from('notificacoes').select('id', { count:'exact', head:true })
        .eq('user_id', data.user.id).eq('lida', false)
        .then(({ count }) => setNotifCount(count ?? 0))

      // Mensagens não lidas
      supabase.from('conversas').select('id')
        .or(`contratante_id.eq.${data.user.id},prestador_id.eq.${data.user.id}`)
        .then(async ({ data: convs }) => {
          if (!convs?.length) return
          const ids = convs.map(c => c.id)
          const { count } = await supabase.from('mensagens')
            .select('id', { count:'exact', head:true })
            .in('conversa_id', ids).eq('lida', false).neq('remetente_id', data.user.id)
          setMsgCount(count ?? 0)
        })

      await Promise.all([loadJobs(data.user.id), loadCandidaturas(data.user.id)])
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: atualiza candidaturas a cada 5s enquanto houver pendentes ou confirmadas recentes
  useEffect(() => {
    if (!userId) return
    // Polling ativo se tiver pendentes (aguardando resposta)
    const hasPending = candidaturas.some(c => c.status === 'pendente')
    if (!hasPending) return

    const interval = setInterval(() => {
      loadCandidaturas(userId)
    }, 5000)

    return () => clearInterval(interval)
  }, [userId, candidaturas, loadCandidaturas])

  // Função para abrir o chat de uma candidatura confirmada
  async function irParaChat(cand: Candidatura) {
    if (!userId || !cand.posts) return
    const post = cand.posts
    const { data, error } = await supabase
      .from('conversas')
      .upsert(
        { post_id: cand.post_id, contratante_id: post.user_id, prestador_id: userId },
        { onConflict: 'post_id,prestador_id' }
      )
      .select('id')
      .single()
    if (!error && data) router.push(`/chat/${data.id}`)
  }

  const pendingCount = candidaturas.filter(c => c.status === 'pendente').length
  const activeCount  = candidaturas.filter(c => c.status === 'confirmada' || c.status === 'aceita').length

  return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', maxWidth:480, margin:'0 auto' }}>

      {/* ── Header fixo ─── */}
      <header style={{ position:'fixed', top:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, zIndex:100, backgroundColor:'#0F0F0F', borderBottom:'1px solid #181818' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
            <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>pato<span style={{ color:'#FFD11A' }}>.ai</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => router.push('/buscar')} style={{ background:'none', border:'none', cursor:'pointer', color:'#555', display:'flex', padding:0 }}>
              <IconSearch />
            </button>
            <button style={{ position:'relative', background:'none', border:'none', cursor:'pointer', color:'#aaa', padding:0, display:'flex' }}>
              <IconBell />
              {notifCount > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:8, backgroundColor:'#E74C3C', color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
            {profile && <Avatar src={profile.avatar_url} name={profile.full_name} size={30} />}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', padding:'0 16px' }}>
          {([
            { key:'disponíveis', label:'Disponíveis' },
            { key:'propostas',   label:`Minhas propostas${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background:'none', border:'none', cursor:'pointer',
              padding:'10px 16px', fontSize:14,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#fff' : '#555',
              borderBottom: `2px solid ${tab === t.key ? '#FFD11A' : 'transparent'}`,
              transition:'all 0.15s', whiteSpace:'nowrap',
            }}>{t.label}</button>
          ))}
        </div>
      </header>

      {/* ── Conteúdo ─── */}
      <main style={{ paddingTop:108, paddingBottom:NAV_H + 20 }}>

        {/* ══ ABA: DISPONÍVEIS ══ */}
        {tab === 'disponíveis' && (
          <>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}>
                <div style={{ width:32, height:32, border:'3px solid #222', borderTopColor:'#FFD11A', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:56, marginBottom:16 }}>🦆</div>
                <p style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>Nenhum bico disponível</p>
                <p style={{ fontSize:14, color:'#555', margin:0 }}>Novos bicos aparecem aqui assim que são publicados.</p>
              </div>
            ) : (
              <div style={{ padding:'8px 14px 0' }}>
                {/* Banner ativo se tiver contratados */}
                {activeCount > 0 && (
                  <div onClick={() => setTab('propostas')} style={{ backgroundColor:'#0d2a0d', border:'1px solid #22C55E44', borderRadius:12, padding:'12px 14px', marginBottom:12, cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20 }}>🎉</span>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#22C55E' }}>Você tem {activeCount} serviço{activeCount > 1 ? 's' : ''} confirmado{activeCount > 1 ? 's' : ''}!</p>
                      <p style={{ margin:'2px 0 0', fontSize:12, color:'#555' }}>Toque para ver detalhes →</p>
                    </div>
                  </div>
                )}

                {jobs.map(p => (
                  <div key={p.id} onClick={() => router.push(`/bico/${p.id}`)} style={{ backgroundColor:'#141414', borderRadius:14, marginBottom:10, overflow:'hidden', border:'1px solid #1e1e1e', cursor:'pointer' }}>
                    {p.urgency === 'hoje' && (
                      <div style={{ backgroundColor:'#2a1000', padding:'4px 14px' }}>
                        <span style={{ fontSize:10, fontWeight:800, color:'#FF6B35', letterSpacing:'0.07em' }}>🔴 URGENTE — PRECISA HOJE</span>
                      </div>
                    )}
                    <div style={{ padding:'14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <Avatar src={p.profiles.avatar_url} name={p.profiles.full_name} size={32} />
                        <div>
                          <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#888' }}>{p.profiles.full_name || 'Usuário'}</p>
                          <p style={{ margin:0, fontSize:11, color:'#444' }}>{timeAgo(p.created_at)}</p>
                        </div>
                        {p.category && (
                          <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:'#FFD11A', backgroundColor:'#1a1500', borderRadius:6, padding:'2px 7px' }}>{p.category}</span>
                        )}
                      </div>

                      <p style={{ margin:'0 0 6px', fontSize:16, fontWeight:800, color:'#fff', lineHeight:1.3 }}>{p.title}</p>
                      {p.description && (
                        <p style={{ margin:'0 0 10px', fontSize:13, color:'#666', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                          {p.description}
                        </p>
                      )}

                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {(p.budget_min || p.budget_max) && (
                          <span style={{ display:'flex', alignItems:'center', gap:3, color:'#FFD11A', fontSize:13, fontWeight:700 }}>
                            <IconWallet />R$ {p.budget_min ?? '?'}–{p.budget_max ?? '?'}
                          </span>
                        )}
                        {(p.city || p.profiles.city) && (
                          <span style={{ display:'flex', alignItems:'center', gap:3, color:'#555', fontSize:12 }}>
                            <IconPin />{p.city || p.profiles.city}
                          </span>
                        )}
                        <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'#FFD11A' }}>ver bico →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ ABA: MINHAS PROPOSTAS ══ */}
        {tab === 'propostas' && (
          <div style={{ padding:'8px 14px 0' }}>
            {candidaturas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:56, marginBottom:16 }}>📋</div>
                <p style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>Nenhuma proposta enviada</p>
                <p style={{ fontSize:14, color:'#555', margin:0 }}>Explore os bicos disponíveis e envie sua primeira proposta!</p>
                <button onClick={() => setTab('disponíveis')} style={{ marginTop:16, height:42, borderRadius:10, border:'none', backgroundColor:'#FFD11A', color:'#000', fontSize:14, fontWeight:700, cursor:'pointer', padding:'0 20px' }}>
                  Explorar bicos →
                </button>
              </div>
            ) : (
              candidaturas.map(c => {
                const post = c.posts
                if (!post) return null
                const isClosed = post.status === 'fechado' || post.status === 'concluido'
                return (
                  <div key={c.id} style={{ backgroundColor:'#141414', borderRadius:14, marginBottom:10, overflow:'hidden', border:`1px solid ${c.status === 'confirmada' || c.status === 'aceita' ? '#22C55E33' : '#1e1e1e'}` }}>
                    {/* Status banner */}
                    {(c.status === 'confirmada' || c.status === 'aceita') && (
                      <div style={{ backgroundColor:'#0d2a0d', padding:'5px 14px', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:800, color:'#22C55E', letterSpacing:'0.07em' }}>🎉 VOCÊ FOI CONTRATADO</span>
                      </div>
                    )}
                    <div style={{ padding:'14px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                        <Avatar src={(post.profiles as { avatar_url?: string|null })?.avatar_url} name={(post.profiles as { full_name?: string|null })?.full_name} size={38} />
                        <div style={{ flex:1, minWidth:0 }}>
                          {post.category && <p style={{ margin:'0 0 2px', fontSize:11, color:'#FFD11A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{post.category}</p>}
                          <p style={{ margin:'0 0 2px', fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>{post.title}</p>
                          {post.city && <p style={{ margin:0, fontSize:11, color:'#555', display:'flex', alignItems:'center', gap:3 }}><IconPin />{post.city}</p>}
                        </div>
                        <CandStatusBadge status={c.status} />
                      </div>

                      {c.proposta && (
                        <div style={{ backgroundColor:'#1a1a1a', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                          <p style={{ margin:0, fontSize:12, color:'#888', fontStyle:'italic', lineHeight:1.5 }}>
                            &ldquo;{c.proposta.length > 120 ? c.proposta.slice(0,117)+'…' : c.proposta}&rdquo;
                          </p>
                          {c.valor && <p style={{ margin:'4px 0 0', fontSize:13, fontWeight:700, color:'#FFD11A' }}>R$ {c.valor}</p>}
                        </div>
                      )}

                      <div style={{ display:'flex', gap:8 }}>
                        {(c.status === 'confirmada' || c.status === 'aceita') ? (
                          <button
                            onClick={() => irParaChat(c)}
                            style={{ flex:1, height:38, borderRadius:8, border:'none', backgroundColor:'#FFD11A', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                            💬 Ir para o chat
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/bico/${post.id}`)}
                            style={{ flex:1, height:38, borderRadius:8, border:'1px solid #2a2a2a', backgroundColor:'transparent', color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                            Ver bico →
                          </button>
                        )}
                        <span style={{ display:'flex', alignItems:'center', fontSize:11, color:'#444' }}>{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>

      {/* ── Bottom nav ─── */}
      <nav style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, height:NAV_H, backgroundColor:'#0a0a0a', borderTop:'1px solid #181818', display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:100 }}>
        <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:'#FFD11A' }}>
          <IconBriefcase /><span style={{ fontSize:10, fontWeight:600 }}>Explorar</span>
        </button>
        <button onClick={() => router.push('/conversas')} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:'#444' }}>
          <IconChat />
          {msgCount > 0 && <span style={{ position:'absolute', top:0, right:-4, width:16, height:16, borderRadius:8, backgroundColor:'#FFD11A', color:'#000', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{msgCount > 9 ? '9+' : msgCount}</span>}
          <span style={{ fontSize:10, fontWeight:600 }}>Msgs</span>
        </button>
        <button onClick={() => router.push('/perfil')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:'#444' }}>
          <IconUser /><span style={{ fontSize:10, fontWeight:600 }}>Perfil</span>
        </button>
      </nav>
    </div>
  )
}
