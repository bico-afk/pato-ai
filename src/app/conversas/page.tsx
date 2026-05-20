'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { dbg } from '@/components/DebugOverlay'

const COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h=0; for(const c of n) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length] }
function initials(n: string) { return (n||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1) return 'agora'; if(m<60) return `há ${m}m`
  const h=Math.floor(m/60); if(h<24) return `há ${h}h`
  return `há ${Math.floor(h/24)}d`
}

interface Profile { id: string; full_name: string|null; avatar_url: string|null; city: string|null }
interface Conversa {
  id: string; post_id: string; contratante_id: string; prestador_id: string; created_at: string
  posts: { id: string; title: string; category: string|null }
  lastMessage?: { content: string; created_at: string; remetente_id: string }
  unread?: number
  otherUser?: Profile
}

function IconArrow() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IconMsg() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }

function Avatar({ profile, size=40 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) return <img src={profile.avatar_url} alt="" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover' }} />
  const n = profile.full_name || '?'
  return <div style={{ width:size, height:size, borderRadius:'50%', backgroundColor:avatarColor(n), display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(n)}</div>
}

export default function ConversasPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [userId,    setUserId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const uid = data.user.id
      setUserId(uid)

      // Carrega conversas
      const { data: convs } = await supabase
        .from('conversas')
        .select('id, post_id, contratante_id, prestador_id, created_at, posts(id, title, category)')
        .or(`contratante_id.eq.${uid},prestador_id.eq.${uid}`)
        .order('created_at', { ascending: false })

      if (!convs || convs.length === 0) { setLoading(false); return }

      // Enriquece cada conversa com último msg + não lidas
      const enriched = await Promise.all(convs.map(async (c) => {
        const otherId = c.contratante_id === uid ? c.prestador_id : c.contratante_id
        const [{ data: otherUser }, { data: msgs }, { count: unread }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url, city').eq('id', otherId).single(),
          supabase.from('mensagens').select('content, created_at, remetente_id').eq('conversa_id', c.id).order('created_at', { ascending: false }).limit(1),
          supabase.from('mensagens').select('id', { count: 'exact', head: true }).eq('conversa_id', c.id).eq('lida', false).neq('remetente_id', uid),
        ])
        return {
          ...c,
          posts: c.posts as unknown as { id: string; title: string; category: string|null },
          otherUser: otherUser as Profile | undefined,
          lastMessage: msgs?.[0] ?? undefined,
          unread: unread ?? 0,
        } as Conversa
      }))

      setConversas(enriched)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', maxWidth:480, margin:'0 auto' }}>
      <div style={{ position:'sticky', top:0, backgroundColor:'#0F0F0F', zIndex:10, borderBottom:'1px solid #181818' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px' }}>
          <button onClick={() => router.push('/feed')} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
            <IconArrow /> voltar
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
            <span style={{ fontSize:16, fontWeight:800, color:'#fff' }}>pato<span style={{ color:'#FFD11A' }}>.ai</span></span>
          </div>
          <div style={{ width:60 }} />
        </div>
        <div style={{ padding:'0 16px 14px' }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.5px' }}>Mensagens</h1>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:32, height:32, border:'3px solid #222', borderTopColor:'#FFD11A', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : conversas.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'80px 24px', textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:14 }}><IconMsg /></div>
          <p style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>Nenhuma conversa ainda</p>
          <p style={{ fontSize:14, color:'#555', margin:0, lineHeight:1.5 }}>As conversas com contratantes e patos aparecem aqui.</p>
        </div>
      ) : (
        <div>
          {conversas.map(c => (
            <div key={c.id} onClick={() => { dbg('info', `abrindo chat: ${c.id}`); console.log('[Conversas] navegando para /chat/', c.id); router.push(`/chat/${c.id}`) }}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid #141414', cursor:'pointer', backgroundColor: c.unread ? '#121200' : 'transparent', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#161616'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = c.unread ? '#121200' : 'transparent'}
            >
              {c.otherUser && <Avatar profile={c.otherUser} size={48} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{c.otherUser?.full_name || 'Usuário'}</span>
                  <span style={{ fontSize:11, color:'#444' }}>{c.lastMessage ? timeAgo(c.lastMessage.created_at) : timeAgo(c.created_at)}</span>
                </div>
                <p style={{ margin:'0 0 4px', fontSize:12, color:'#444', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  🔧 {c.posts?.title || 'Bico'}
                </p>
                <p style={{ margin:0, fontSize:13, color: c.unread ? '#aaa' : '#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: c.unread ? 600 : 400 }}>
                  {c.lastMessage
                    ? (c.lastMessage.remetente_id === userId ? 'Você: ' : '') + c.lastMessage.content
                    : 'Conversa iniciada'}
                </p>
              </div>
              {(c.unread ?? 0) > 0 && (
                <div style={{ width:20, height:20, borderRadius:'50%', backgroundColor:'#FFD11A', color:'#000', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {c.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
