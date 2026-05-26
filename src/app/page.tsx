'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import GlobeCanvas from '@/components/GlobeCanvas'

/* ─── Types ─────────────────────────────────────────────────── */
interface Post {
  id: string; created_at: string; title: string
  city: string | null; user_id: string
}

/* ─── Helpers ───────────────────────────────────────────────── */
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

const ADJ  = ['Curioso','Rápido','Esperto','Direto','Animado','Humilde','Veloz','Firme']
const NOUN = ['Leão','Tigre','Águia','Lobo','Falcão','Urso','Puma','Touro']
function anonName(id: string) {
  if (!id) return 'Anônimo'
  const b = parseInt(id.replace(/-/g,'').slice(-4), 16) || 0
  return `${ADJ[b%ADJ.length]} ${NOUN[Math.floor(b/ADJ.length)%NOUN.length]}`
}

function getOrCreateAnonId() {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('bikco_anon_id')
  if (!id) {
    id = crypto.randomUUID?.() ?? (Math.random().toString(36).slice(2)+Date.now().toString(36))
    localStorage.setItem('bikco_anon_id', id)
  }
  return id
}

function useCounter(initial: number) {
  const [v, setV] = useState(initial)
  useEffect(() => {
    const tick = () => { setV(n=>n+Math.floor(Math.random()*3)+1); setTimeout(tick,3500+Math.random()*4000) }
    const id = setTimeout(tick, 5000)
    return () => clearTimeout(id)
  }, [])
  return v
}

/* ─── Post Card ─────────────────────────────────────────────── */
function PostCard({ post, onApply, isNew, applying }: {
  post: Post; onApply: () => void; isNew?: boolean; applying?: boolean
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isNew ? 'rgba(99,91,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      animation: isNew ? 'slideDown 0.3s ease' : undefined,
      backdropFilter: 'blur(8px)',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div style={{
          width:24, height:24, borderRadius:'50%', flexShrink:0,
          background:'rgba(99,91,255,0.15)', border:'1px solid rgba(99,91,255,0.2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:9, fontWeight:800, color:'#a78bfa',
        }}>{anonName(post.user_id)[0]}</div>
        <span style={{ fontSize:12, color:'#64748b' }}>{anonName(post.user_id)}</span>
        {post.city && <span style={{ fontSize:12, color:'#334155' }}>· {post.city}</span>}
        <span style={{ fontSize:11, color:'#1e293b', marginLeft:'auto' }}>{timeAgo(post.created_at)}</span>
      </div>
      <p style={{
        fontSize:14, color:'#cbd5e1', lineHeight:1.55, margin:0,
        display:'-webkit-box', WebkitLineClamp:3,
        WebkitBoxOrient:'vertical' as const, overflow:'hidden',
      }}>{post.title}</p>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={onApply} disabled={applying} style={{
          height:30, borderRadius:99, border:'none',
          background: applying ? 'rgba(99,91,255,0.1)' : 'linear-gradient(135deg,#635bff,#0073e6)',
          color: applying ? '#4a4a6a' : '#fff',
          fontSize:12, fontWeight:600, cursor: applying?'not-allowed':'pointer', padding:'0 14px',
          display:'flex', alignItems:'center', gap:6,
        }}>
          {applying&&<span style={{width:10,height:10,border:'2px solid #333',borderTopColor:'#635bff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}}/>}
          {applying ? 'Abrindo...' : 'Me candidatar →'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router  = useRouter()
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [text,       setText]       = useState('')
  const [posts,      setPosts]      = useState<Post[]>([])
  const [newIds,     setNewIds]     = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [posting,    setPosting]    = useState(false)
  const [anonId,     setAnonId]     = useState('')
  const [mounted,    setMounted]    = useState(false)
  const [toast,      setToast]      = useState<{msg:string;ok:boolean;postId?:string}|null>(null)
  const [focused,    setFocused]    = useState(false)
  const [applyingId, setApplyingId] = useState<string|null>(null)
  const [badgeCount, setBadgeCount] = useState(0)

  const activeCount = useCounter(2847)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let uid: string|null = null
      if (session?.user) { uid=session.user.id; setAnonId(session.user.id) }
      else {
        const { data } = await supabase.auth.signInAnonymously()
        if (data.user) { uid=data.user.id; setAnonId(data.user.id) }
        else { const l=getOrCreateAnonId(); setAnonId(l); uid=l }
      }
      if (uid) {
        const { count } = await supabase.from('conversas')
          .select('id',{count:'exact',head:true}).eq('user2_id',uid).eq('status','ativa')
        setBadgeCount(count??0)
      }
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    const supabase = createClient()
    supabase.from('posts').select('id,created_at,title,city,user_id')
      .eq('status','aberto').order('created_at',{ascending:false}).limit(30)
      .then(({ data }) => { setPosts(data??[]); setLoading(false) })

    const ch = supabase.channel('home-feed')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'posts'},payload=>{
        const raw=payload.new as Post&{status?:string}
        if (raw.status!==undefined&&raw.status!=='aberto') return
        const p:Post={id:raw.id,created_at:raw.created_at,title:raw.title,city:raw.city,user_id:raw.user_id}
        setPosts(prev=>[p,...prev.slice(0,29)])
        setNewIds(prev=>new Set([...prev,p.id]))
        setTimeout(()=>setNewIds(prev=>{const n=new Set(prev);n.delete(p.id);return n}),3000)
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [mounted])

  useEffect(() => {
    const el=textRef.current; if(!el) return
    el.style.height='auto'
    el.style.height=Math.min(el.scrollHeight,160)+'px'
  }, [text])

  const handlePost = useCallback(async () => {
    const t=text.trim(); if(!t||posting) return
    setPosting(true)
    try {
      const supabase=createClient()
      const {data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/quick-post',{
        method:'POST',
        headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},
        body:JSON.stringify({text:t}),
      })
      const json=await res.json()
      if(!json.ok) throw new Error(json.error??'Erro')
      setText('')
      setToast({msg:'✅ Pedido publicado!',ok:true,postId:json.post?.id})
    } catch(e) {
      setToast({msg:`❌ ${e instanceof Error?e.message:'Erro'}`,ok:false})
    } finally { setPosting(false); setTimeout(()=>setToast(null),3500) }
  }, [text, posting])

  const handleApply = useCallback(async (post: Post) => {
    if(!anonId||applyingId) return
    if(anonId===post.user_id){router.push(`/pedido/${post.id}`);return}
    setApplyingId(post.id)
    try {
      const supabase=createClient()
      const {data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/apply',{
        method:'POST',
        headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},
        body:JSON.stringify({postId:post.id}),
      })
      const json=await res.json()
      if(!json.ok) throw new Error(json.error??'Erro')
      router.push(`/chat/${json.conversaId}`)
    } catch(e) {
      setToast({msg:`❌ ${e instanceof Error?e.message:'Erro'}`,ok:false})
      setTimeout(()=>setToast(null),3500)
    } finally { setApplyingId(null) }
  }, [anonId, applyingId, router])

  if (!mounted) return null

  return (
    <div style={{ minHeight:'100dvh', background:'#060613', fontFamily:"'Inter',system-ui,sans-serif", color:'#fff', overflowX:'hidden' }}>

      {/* ══ GRADIENT MESH BACKGROUND (Stripe-style) ══ */}
      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div className="mesh mesh1"/>
        <div className="mesh mesh2"/>
        <div className="mesh mesh3"/>
        <div className="mesh mesh4"/>
        {/* Noise overlay */}
        <div style={{ position:'absolute', inset:0, opacity:0.035, backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize:'200px' }} />
      </div>

      {/* ══ HEADER ══ */}
      <header style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        height:56,
      }}>
        <div style={{
          maxWidth:1100, margin:'0 auto', height:'100%',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 24px',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Image src="/pato-icon.svg" alt="Bikco" width={18} height={18}/>
            <span style={{ fontSize:15, fontWeight:900, letterSpacing:'-0.5px' }}>
              bikco<span style={{ color:'#635bff' }}>.com</span>
            </span>
          </div>

          <nav style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={()=>router.push('/feed')} style={{
              height:32, borderRadius:8, border:'none',
              background:'transparent', color:'#94a3b8', fontSize:13, fontWeight:500,
              cursor:'pointer', padding:'0 14px', transition:'color 0.15s',
            }}>
              Para profissionais
            </button>
            <button onClick={()=>router.push('/meus-pedidos')} style={{
              position:'relative', height:32, borderRadius:8, border:'none',
              background:'transparent', color:'#94a3b8', fontSize:13, fontWeight:500,
              cursor:'pointer', padding:'0 14px', display:'flex', alignItems:'center', gap:5,
            }}>
              Meus pedidos
              {badgeCount>0&&<span style={{background:'#635bff',color:'#fff',borderRadius:99,fontSize:9,fontWeight:800,padding:'1px 5px'}}>{badgeCount}</span>}
            </button>
            <button onClick={()=>router.push('/login')} style={{
              height:32, borderRadius:8,
              border:'1px solid rgba(255,255,255,0.12)',
              background:'rgba(255,255,255,0.05)', color:'#e2e8f0',
              fontSize:13, fontWeight:600, cursor:'pointer', padding:'0 16px',
              transition:'all 0.15s',
            }}>
              Entrar
            </button>
          </nav>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section style={{ position:'relative', zIndex:1, paddingTop:56, minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* Content */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', textAlign:'center',
          padding:'80px 24px 0', maxWidth:780, width:'100%',
        }}>
          {/* Pill badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(99,91,255,0.12)', border:'1px solid rgba(99,91,255,0.25)',
            borderRadius:99, padding:'5px 14px', marginBottom:28,
          }}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 8px #22c55e',display:'inline-block',animation:'blink 2s ease-in-out infinite'}}/>
            <span style={{fontSize:12,fontWeight:600,color:'#a78bfa'}}>
              <span style={{color:'#c4b5fd'}}>{activeCount.toLocaleString('pt-BR')}</span> pedidos ativos agora
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize:'clamp(40px,6.5vw,76px)',
            fontWeight:900,
            letterSpacing:'-3px',
            lineHeight:1.02,
            marginBottom:20,
            background:'linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.75) 100%)',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>
            A plataforma de serviços<br/>que o Brasil precisava.
          </h1>

          <p style={{
            fontSize:'clamp(16px,2vw,20px)',
            color:'#64748b',
            lineHeight:1.65,
            marginBottom:36,
            maxWidth:520,
            fontWeight:400,
          }}>
            Publique qualquer serviço em segundos. Pedreiro, eletricista,
            faxina, árbitro de pelada — profissionais respondem na hora.
          </p>

          {/* Input + CTA */}
          <div style={{ width:'100%', maxWidth:520, marginBottom:12 }}>
            <div style={{
              background:'rgba(255,255,255,0.04)',
              border:`1.5px solid ${focused?'rgba(99,91,255,0.6)':'rgba(255,255,255,0.1)'}`,
              borderRadius:16,
              transition:'border-color 0.2s, box-shadow 0.2s',
              boxShadow: focused ? '0 0 0 4px rgba(99,91,255,0.12)' : 'none',
            }}>
              <textarea
                ref={textRef} value={text}
                onChange={e=>setText(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();handlePost()}}}
                onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                placeholder="Ex: pintar sala 30m² em SP, árbitro de pelada domingo às 10h..."
                rows={2}
                style={{
                  width:'100%', background:'none', border:'none', outline:'none',
                  color:'#e2e8f0', fontSize:15, lineHeight:1.6, resize:'none',
                  padding:'14px 16px 6px', fontFamily:'inherit', boxSizing:'border-box',
                  minHeight:66, maxHeight:160,
                }}
              />
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 10px 10px'}}>
                <span style={{fontSize:11,color:'#1e293b'}}>⌘ Enter para publicar</span>
                <button onClick={handlePost} disabled={!text.trim()||posting} style={{
                  height:36, borderRadius:10, border:'none',
                  background: text.trim()&&!posting
                    ? 'linear-gradient(135deg,#635bff 0%,#0073e6 100%)'
                    : 'rgba(255,255,255,0.04)',
                  color: text.trim()&&!posting ? '#fff' : '#1e293b',
                  fontSize:13, fontWeight:700,
                  cursor: text.trim()&&!posting ? 'pointer' : 'default',
                  padding:'0 20px', transition:'all 0.15s',
                  display:'flex', alignItems:'center', gap:7,
                  boxShadow: text.trim()&&!posting ? '0 4px 16px rgba(99,91,255,0.4)' : 'none',
                }}>
                  {posting
                    ? <span style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
                    : 'Publicar →'}
                </button>
              </div>
            </div>
          </div>

          {anonId&&<p style={{fontSize:11,color:'#1e293b',marginBottom:48}}>Publicando como <span style={{color:'#334155'}}>{anonName(anonId)}</span> · anônimo</p>}
        </div>

        {/* Globe — product visual, centered, fades at bottom */}
        <div style={{
          position:'relative',
          width:'min(560px, 90vw)',
          height:'min(560px, 90vw)',
          flexShrink:0,
          marginTop: anonId ? 0 : 48,
        }}>
          <GlobeCanvas/>
          {/* Bottom fade — blends globe into next section */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'45%',
            background:'linear-gradient(to bottom, transparent 0%, #060613 100%)',
            pointerEvents:'none',
          }}/>
          {/* Side fades */}
          <div style={{position:'absolute',top:0,left:0,bottom:0,width:'8%',background:'linear-gradient(to right,#060613,transparent)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:0,right:0,bottom:0,width:'8%',background:'linear-gradient(to left,#060613,transparent)',pointerEvents:'none'}}/>
        </div>
      </section>

      {/* ══ STATS STRIP ══ */}
      <div style={{ position:'relative', zIndex:1, borderTop:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)', padding:'20px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:'clamp(24px,5vw,80px)', flexWrap:'wrap' }}>
          {[
            { n:'2.847+', label:'Pedidos ativos' },
            { n:'140+', label:'Cidades cobertas' },
            { n:'< 3min', label:'Tempo médio de resposta' },
            { n:'100%', label:'Grátis para publicar' },
          ].map(s=>(
            <div key={s.n} style={{textAlign:'center'}}>
              <div style={{fontSize:'clamp(20px,3vw,28px)',fontWeight:800,letterSpacing:'-1px',color:'#e2e8f0'}}>{s.n}</div>
              <div style={{fontSize:12,color:'#475569',fontWeight:500,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ COMO FUNCIONA ══ */}
      <section style={{ position:'relative', zIndex:1, padding:'80px 24px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <p style={{textAlign:'center',fontSize:12,fontWeight:700,letterSpacing:'2px',color:'#635bff',textTransform:'uppercase',marginBottom:14}}>Como funciona</p>
          <h2 style={{textAlign:'center',fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1.5px',marginBottom:56,color:'#f1f5f9'}}>
            Simples como mandar uma mensagem
          </h2>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
            {[
              { icon:'✍️', title:'1. Descreva o que precisa', desc:'Escreva em linguagem natural. Sem formulários chatos, sem cadastro obrigatório.' },
              { icon:'⚡', title:'2. Profissionais respondem', desc:'Quem tem o perfil certo recebe notificação e pode se candidatar em um toque.' },
              { icon:'🤝', title:'3. Combine e contrate', desc:'Converse direto pelo chat, combine o valor e feche o bico com segurança.' },
            ].map(c=>(
              <div key={c.title} style={{
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:20, padding:'28px 24px',
                transition:'border-color 0.2s, background 0.2s',
              }}>
                <div style={{fontSize:32,marginBottom:16}}>{c.icon}</div>
                <h3 style={{fontSize:16,fontWeight:700,marginBottom:8,color:'#f1f5f9',letterSpacing:'-0.3px'}}>{c.title}</h3>
                <p style={{fontSize:14,color:'#64748b',lineHeight:1.65,margin:0}}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEED ══ */}
      <section style={{ position:'relative', zIndex:1, padding:'0 24px 100px' }}>
        <div style={{ maxWidth:620, margin:'0 auto' }}>

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, justifyContent:'center' }}>
            <h2 style={{fontSize:'clamp(24px,3vw,32px)',fontWeight:800,letterSpacing:'-1px',color:'#f1f5f9'}}>Pedidos em aberto agora</h2>
            {!loading&&posts.length>0&&(
              <span style={{fontSize:11,fontWeight:700,color:'#635bff',background:'rgba(99,91,255,0.12)',border:'1px solid rgba(99,91,255,0.2)',borderRadius:99,padding:'3px 9px'}}>{posts.length}</span>
            )}
            <span style={{fontSize:10,color:'#22c55e',display:'flex',alignItems:'center',gap:4,marginLeft:4}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'blink 2s ease-in-out infinite'}}/>
              ao vivo
            </span>
          </div>

          {loading&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[1,2,3].map(i=>(
                <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{height:10,width:110,borderRadius:6,background:'rgba(255,255,255,0.06)'}}/>
                  <div style={{height:12,borderRadius:6,background:'rgba(255,255,255,0.04)'}}/>
                  <div style={{height:12,width:'65%',borderRadius:6,background:'rgba(255,255,255,0.03)'}}/>
                </div>
              ))}
            </div>
          )}

          {!loading&&posts.length===0&&(
            <div style={{textAlign:'center',padding:'48px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>📭</div>
              <p style={{fontSize:14,color:'#475569'}}>Nenhum pedido ainda — seja o primeiro!</p>
            </div>
          )}

          {!loading&&posts.length>0&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {posts.map(p=>(
                <PostCard key={p.id} post={p} isNew={newIds.has(p.id)}
                  applying={applyingId===p.id} onApply={()=>handleApply(p)}/>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ position:'relative', zIndex:1, borderTop:'1px solid rgba(255,255,255,0.05)', padding:'32px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Image src="/pato-icon.svg" alt="Bikco" width={14} height={14}/>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:'-0.3px',color:'#334155'}}>bikco<span style={{color:'#635bff'}}>.com</span></span>
          </div>
          <p style={{fontSize:11,color:'#1e293b'}}>© 2025 Bikco · Diga o que precisa. Alguém vai fazer.</p>
        </div>
      </footer>

      {/* Toast */}
      {toast&&(
        <div style={{
          position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',
          background:'rgba(6,6,19,0.95)',backdropFilter:'blur(12px)',
          border:`1px solid ${toast.ok?'rgba(99,91,255,0.3)':'rgba(239,68,68,0.3)'}`,
          borderRadius:99, padding:'10px 20px',
          fontSize:13, fontWeight:600, color:'#e2e8f0',
          boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
          zIndex:999, whiteSpace:'nowrap',
          animation:'toastIn 0.2s ease', display:'flex', alignItems:'center', gap:10,
        }}>
          {toast.msg}
          {toast.postId&&(
            <button onClick={()=>router.push(`/pedido/${toast.postId}`)}
              style={{background:'#635bff',color:'#fff',border:'none',borderRadius:99,fontSize:11,fontWeight:700,cursor:'pointer',padding:'3px 10px'}}>
              Ver →
            </button>
          )}
        </div>
      )}

      <style>{`
        /* Gradient mesh — Stripe signature */
        .mesh {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          will-change: transform;
        }
        .mesh1 {
          width: 800px; height: 600px;
          background: radial-gradient(ellipse, rgba(99,91,255,0.45) 0%, transparent 70%);
          top: -200px; left: 50%; transform: translateX(-50%);
          animation: m1 14s ease-in-out infinite;
        }
        .mesh2 {
          width: 600px; height: 500px;
          background: radial-gradient(ellipse, rgba(0,115,230,0.3) 0%, transparent 70%);
          top: 100px; right: -150px;
          animation: m2 18s ease-in-out infinite;
        }
        .mesh3 {
          width: 500px; height: 400px;
          background: radial-gradient(ellipse, rgba(14,165,233,0.2) 0%, transparent 70%);
          top: 300px; left: -100px;
          animation: m3 16s ease-in-out infinite;
        }
        .mesh4 {
          width: 400px; height: 400px;
          background: radial-gradient(ellipse, rgba(139,92,246,0.2) 0%, transparent 70%);
          bottom: 100px; right: 20%;
          animation: m4 20s ease-in-out infinite;
        }
        @keyframes m1 { 0%,100%{transform:translateX(-50%) scale(1);} 50%{transform:translateX(-50%) scale(1.15) translateY(30px);} }
        @keyframes m2 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-60px,80px);} }
        @keyframes m3 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(80px,-60px);} }
        @keyframes m4 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-40px,40px);} }

        @keyframes spin     { to{transform:rotate(360deg);} }
        @keyframes blink    { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes slideDown{ from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes toastIn  { from{opacity:0;transform:translateX(-50%) translateY(8px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }

        *           { box-sizing:border-box; margin:0; }
        ::-webkit-scrollbar { display:none; }
        body        { background:#060613; }
        textarea::placeholder { color:#1e293b; }
        nav button:hover { color:#e2e8f0 !important; }
        @media(max-width:600px){
          nav button:not(:last-child){ display:none; }
        }
      `}</style>
    </div>
  )
}
