'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ── Types ─────────────────────────────────────────────── */
interface Profile {
  id: string; full_name: string | null; avatar_url: string | null
  city: string | null; state: string | null; seal: string | null
  type: string | null; bio: string | null; score: number | null
  created_at: string | null
}
interface Post {
  id: string; title: string; description: string | null; category: string | null
  city: string | null; urgency: string | null; status: string; created_at: string
  tipo: string | null
  candidaturas: { id: string }[]
}
interface TrabalhoRealizado {
  id: string; status: string; created_at: string
  posts: { id: string; title: string; category: string | null; city: string | null; user_id: string }
}

/* ── Helpers ─────────────────────────────────────────────── */
const COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h=0; for(const c of n) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length] }
function initials(n: string) { return (n||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1) return 'agora'; if(m<60) return `há ${m} min`
  const h=Math.floor(m/60); if(h<24) return `há ${h}h`
  const days = Math.floor(h/24); if(days<30) return `há ${days}d`
  return `há ${Math.floor(days/30)}m`
}
const SEAL_COLOR: Record<string,string> = { ouro:'#FFD11A', prata:'#B0B0B0', bronze:'#CD7F32' }
const SEAL_LABEL: Record<string,string> = { ouro:'OURO', prata:'PRATA', bronze:'BRONZE' }
const TYPE_LABEL: Record<string,string> = { contratante:'Contratante', prestador:'Prestador de serviços', ambos:'Contratante & Prestador' }

/* ── Icons ─────────────────────────────────────────────── */
function IconArrow() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IconPin() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IconStar() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD11A" stroke="#FFD11A" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
function IconBriefcase() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> }
function IconCalendar() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }

function EmptySection({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div style={{ backgroundColor:'#141414', borderRadius:14, padding:'28px 16px', textAlign:'center', border:'1px solid #1e1e1e' }}>
      <p style={{ margin:'0 0 6px', fontSize:32 }}>{emoji}</p>
      <p style={{ margin:0, color:'#555', fontSize:13, lineHeight:1.5 }}>{text}</p>
    </div>
  )
}

function PostCard({ post, onClick, isService }: { post: Post; onClick: () => void; isService?: boolean }) {
  return (
    <div onClick={onClick}
      style={{ backgroundColor:'#141414', borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${isService ? '#FFD11A22' : '#1e1e1e'}` }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
        <div style={{ flex:1 }}>
          {isService && <span style={{ fontSize:9, fontWeight:800, color:'#FFD11A', backgroundColor:'#1a1500', borderRadius:4, padding:'2px 6px', marginBottom:6, display:'inline-block' }}>OFEREÇO</span>}
          {post.category && <span style={{ fontSize:10, color: isService ? '#FFD11A' : '#FFD11A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>{post.category}</span>}
          <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.25 }}>{post.title}</p>
          {post.description && <p style={{ margin:'0 0 8px', fontSize:13, color:'#555', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{post.description}</p>}
        </div>
        <span style={{ flexShrink:0, fontSize:10, fontWeight:700, borderRadius:6, padding:'3px 8px', backgroundColor: post.status==='resolvido'?'#0a2a0a':'#1a1a1a', color: post.status==='resolvido'?'#22C55E':'#555', border: post.status==='resolvido'?'1px solid #22C55E33':'1px solid #2a2a2a' }}>
          {post.status==='resolvido'?'✓ resolvido':'aberto'}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        {post.city && <span style={{ display:'flex', alignItems:'center', gap:3, color:'#444', fontSize:11 }}><IconPin />{post.city}</span>}
        {post.urgency==='hoje' && <span style={{ fontSize:10, fontWeight:700, color:'#FF6B35' }}>• urgente</span>}
        <span style={{ fontSize:11, color:'#333', marginLeft:'auto' }}>{timeAgo(post.created_at)}</span>
        {post.candidaturas.length>0 && <span style={{ fontSize:11, color:'#444' }}>{post.candidaturas.length} proposta{post.candidaturas.length>1?'s':''}</span>}
      </div>
    </div>
  )
}

export default function UsuarioPage() {
  const router   = useRouter()
  const params   = useParams()
  const targetId = params.id as string
  const supabase = createClient()

  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [posts,      setPosts]      = useState<Post[]>([])
  const [servicos,   setServicos]   = useState<Post[]>([])
  const [trabalhos,  setTrabalhos]  = useState<TrabalhoRealizado[]>([])
  const [stats,      setStats]      = useState({ posts: 0, candidaturas: 0, resolvidos: 0 })
  const [loading,    setLoading]    = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [activeTab,  setActiveTab]  = useState<'bicos'|'servicos'|'realizados'>('bicos')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setIsOwnProfile(data.user.id === targetId)

      // Load target profile
      const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId).single()
      if (p) setProfile(p as Profile)

      // Load their posts (bicos — procura)
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id, title, description, category, city, urgency, status, created_at, tipo, candidaturas(id)')
        .eq('user_id', targetId)
        .or('tipo.eq.procura,tipo.is.null')
        .order('created_at', { ascending: false })
        .limit(10)
      if (userPosts) setPosts(userPosts as Post[])

      // Load their service offerings (oferta)
      const { data: ofertas } = await supabase
        .from('posts')
        .select('id, title, description, category, city, urgency, status, created_at, tipo, candidaturas(id)')
        .eq('user_id', targetId)
        .eq('tipo', 'oferta')
        .order('created_at', { ascending: false })
        .limit(10)
      if (ofertas) setServicos(ofertas as Post[])

      // Load completed works (candidaturas aceitas)
      const { data: realizados } = await supabase
        .from('candidaturas')
        .select('id, status, created_at, posts(id, title, category, city, user_id)')
        .eq('prestador_id', targetId)
        .in('status', ['aceita', 'concluida'])
        .order('created_at', { ascending: false })
        .limit(10)
      if (realizados) setTrabalhos(realizados as unknown as TrabalhoRealizado[])

      // Stats
      const [{ count: postCount }, { count: candCount }, { count: resolvidoCount }] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', targetId),
        supabase.from('candidaturas').select('id', { count: 'exact', head: true }).eq('prestador_id', targetId),
        supabase.from('candidaturas').select('id', { count: 'exact', head: true }).eq('prestador_id', targetId).in('status', ['aceita','concluida']),
      ])
      setStats({ posts: postCount ?? 0, candidaturas: candCount ?? 0, resolvidos: resolvidoCount ?? 0 })
      setLoading(false)
    })
  }, [targetId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #222', borderTopColor:'#FFD11A', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <p style={{ color:'#fff', fontSize:18, fontWeight:800 }}>Usuário não encontrado</p>
        <button onClick={() => router.back()} style={{ color:'#FFD11A', background:'none', border:'none', cursor:'pointer', fontSize:15, marginTop:12 }}>← Voltar</button>
      </div>
    )
  }

  const name = profile.full_name || 'Usuário'
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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
        {isOwnProfile
          ? <button onClick={() => router.push('/onboarding')} style={{ fontSize:13, color:'#FFD11A', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>editar</button>
          : <div style={{ width:60 }} />
        }
      </div>

      <div style={{ padding:'28px 16px 80px' }}>

        {/* Avatar + Name */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width:88, height:88, borderRadius:'50%', objectFit:'cover', marginBottom:14, border:'3px solid #1e1e1e' }} />
            : <div style={{ width:88, height:88, borderRadius:'50%', backgroundColor:avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:800, color:'#fff', marginBottom:14, border:'3px solid #1e1e1e' }}>{initials(name)}</div>
          }
          <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.5px', textAlign:'center' }}>{name}</h1>

          {/* Location */}
          {(profile.city || profile.state) && (
            <div style={{ display:'flex', alignItems:'center', gap:4, color:'#555', fontSize:14, marginBottom:10 }}>
              <IconPin />{[profile.city, profile.state].filter(Boolean).join(', ')}
            </div>
          )}

          {/* Badges */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginBottom:10 }}>
            {profile.type && (
              <span style={{ fontSize:12, color:'#777', backgroundColor:'#1a1a1a', borderRadius:8, padding:'4px 10px' }}>
                {TYPE_LABEL[profile.type] || profile.type}
              </span>
            )}
            {profile.seal && (
              <span style={{ fontSize:11, fontWeight:800, color:SEAL_COLOR[profile.seal], border:`1px solid ${SEAL_COLOR[profile.seal]}44`, borderRadius:8, padding:'4px 10px' }}>
                {SEAL_LABEL[profile.seal]}
              </span>
            )}
          </div>

          {/* Score */}
          {profile.score && (
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:15, fontWeight:800, color:'#FFD11A' }}>
              <IconStar />{profile.score.toFixed(1)}
              <span style={{ fontSize:12, color:'#555', fontWeight:400 }}>avaliação</span>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p style={{ margin:'12px 0 0', fontSize:14, color:'#888', lineHeight:1.6, textAlign:'center', maxWidth:320 }}>{profile.bio}</p>
          )}

          {/* Member since */}
          {memberSince && (
            <div style={{ display:'flex', alignItems:'center', gap:4, color:'#444', fontSize:12, marginTop:10 }}>
              <IconCalendar />membro desde {memberSince}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:'flex', borderRadius:14, backgroundColor:'#141414', overflow:'hidden', marginBottom:20, border:'1px solid #1e1e1e' }}>
          {[
            { label:'Bicos postados', value: stats.posts },
            { label:'Candidaturas', value: stats.candidaturas },
            { label:'Resolvidos', value: stats.resolvidos },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, padding:'16px 8px', textAlign:'center', borderRight: i < 2 ? '1px solid #1e1e1e' : 'none' }}>
              <p style={{ margin:0, fontSize:22, fontWeight:800, color:'#fff' }}>{s.value}</p>
              <p style={{ margin:'4px 0 0', fontSize:11, color:'#444', lineHeight:1.3 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #1e1e1e', marginBottom:16 }}>
          {([
            { key:'bicos',     label:'Bicos postados' },
            { key:'servicos',  label:'Serviços que ofereço' },
            { key:'realizados',label:'Realizados' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ flex:1, background:'none', border:'none', cursor:'pointer', padding:'10px 4px', fontSize:12, fontWeight: activeTab===t.key ? 700 : 500, color: activeTab===t.key ? '#fff' : '#444', borderBottom:`2px solid ${activeTab===t.key ? '#FFD11A' : 'transparent'}`, transition:'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Bicos postados */}
        {activeTab === 'bicos' && (
          posts.length === 0 ? (
            <EmptySection emoji="🦆" text="Ainda não postou bicos" />
          ) : posts.map(post => <PostCard key={post.id} post={post} onClick={() => router.push(`/bico/${post.id}`)} />)
        )}

        {/* Serviços que ofereço */}
        {activeTab === 'servicos' && (
          servicos.length === 0 ? (
            <EmptySection emoji="🔧" text={isOwnProfile ? "Você ainda não adicionou serviços que oferece. Crie um post do tipo 'Ofereço serviço'!" : "Ainda não adicionou serviços"} />
          ) : servicos.map(post => <PostCard key={post.id} post={post} onClick={() => router.push(`/bico/${post.id}`)} isService />)
        )}

        {/* Trabalhos realizados */}
        {activeTab === 'realizados' && (
          trabalhos.length === 0 ? (
            <EmptySection emoji="⭐" text="Nenhum trabalho concluído ainda" />
          ) : trabalhos.map(t => (
            <div key={t.id} onClick={() => router.push(`/bico/${t.posts.id}`)}
              style={{ backgroundColor:'#141414', borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:'1px solid #22C55E22' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#22C55E', backgroundColor:'#0a2a0a', border:'1px solid #22C55E33', borderRadius:6, padding:'2px 8px' }}>✓ REALIZADO</span>
                <span style={{ fontSize:11, color:'#444' }}>{timeAgo(t.created_at)}</span>
              </div>
              {t.posts.category && <span style={{ fontSize:10, color:'#FFD11A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>{t.posts.category}</span>}
              <p style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#fff' }}>{t.posts.title}</p>
              {t.posts.city && <p style={{ margin:0, display:'flex', alignItems:'center', gap:3, color:'#444', fontSize:12 }}><IconPin />{t.posts.city}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
