'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

interface Profile { id: string; full_name: string | null; avatar_url: string | null }
interface Contrato {
  id: string; status: string; created_at: string
  post_id: string; contratante_id: string; prestador_id: string
  assinado_contratante: boolean; assinado_prestador: boolean
  posts: { title: string; category: string | null } | null
  contratante_profile?: Profile
  prestador_profile?: Profile
}

const COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h=0; for(const c of n) h=c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length] }
function initials(n: string) { return (n||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if(m<1) return 'agora'; if(m<60) return `há ${m}m`
  const h=Math.floor(m/60); if(h<24) return `há ${h}h`
  return `há ${Math.floor(h/24)}d`
}

function Avatar({ p, size=38 }: { p: Profile; size?: number }) {
  if (p.avatar_url) return <img src={p.avatar_url} alt="" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  const n = p.full_name || '?'
  return <div style={{ width:size, height:size, borderRadius:'50%', backgroundColor:avatarColor(n), display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(n)}</div>
}

function IconArrow() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IconDoc()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }

function StatusBadge({ c, userId }: { c: Contrato; userId: string }) {
  const both = c.assinado_contratante && c.assinado_prestador
  const iSigned = c.contratante_id === userId ? c.assinado_contratante : c.assinado_prestador

  if (both)     return <span style={{ fontSize:10, fontWeight:800, color:'#22C55E', backgroundColor:'#0d2a0d', borderRadius:6, padding:'3px 8px' }}>✓ Assinado</span>
  if (!iSigned) return <span style={{ fontSize:10, fontWeight:800, color:'#FFD11A', backgroundColor:'#1a1500', borderRadius:6, padding:'3px 8px' }}>⚡ Aguarda sua assinatura</span>
  return          <span style={{ fontSize:10, fontWeight:800, color:'#888', backgroundColor:'#1a1a1a', borderRadius:6, padding:'3px 8px' }}>⏳ Aguarda outra parte</span>
}

export default function ContratosPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [userId,    setUserId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'todos'|'pendentes'|'assinados'>('todos')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const uid = data.user.id
      setUserId(uid)

      const { data: cts } = await supabase
        .from('contratos')
        .select('id, status, created_at, post_id, contratante_id, prestador_id, assinado_contratante, assinado_prestador, posts(title, category)')
        .or(`contratante_id.eq.${uid},prestador_id.eq.${uid}`)
        .order('created_at', { ascending: false })

      if (!cts?.length) { setLoading(false); return }

      // Load other party profiles
      const enriched = await Promise.all(cts.map(async (c) => {
        const [{ data: ct }, { data: pr }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').eq('id', c.contratante_id).single(),
          supabase.from('profiles').select('id, full_name, avatar_url').eq('id', c.prestador_id).single(),
        ])
        return {
          ...c,
          posts: c.posts as unknown as { title: string; category: string | null } | null,
          contratante_profile: ct as Profile | undefined,
          prestador_profile:   pr as Profile | undefined,
        } as Contrato
      }))

      setContratos(enriched)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = contratos.filter(c => {
    if (!userId) return true
    if (filter === 'pendentes') {
      const iSigned = c.contratante_id === userId ? c.assinado_contratante : c.assinado_prestador
      return !iSigned
    }
    if (filter === 'assinados') return c.assinado_contratante && c.assinado_prestador
    return true
  })

  const pendingCount = contratos.filter(c => {
    if (!userId) return false
    const iSigned = c.contratante_id === userId ? c.assinado_contratante : c.assinado_prestador
    return !iSigned
  }).length

  return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', maxWidth:480, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, backgroundColor:'#0F0F0F', zIndex:10, borderBottom:'1px solid #181818' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px' }}>
          <button onClick={() => router.push('/feed')} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', display:'flex', padding:0 }}>
            <IconArrow />
          </button>
          <div style={{ flex:1 }}>
            <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.5px' }}>Meus Contratos</h1>
            <p style={{ margin:0, fontSize:12, color:'#555' }}>gerados pela IA · pato.ai</p>
          </div>
          {pendingCount > 0 && (
            <span style={{ backgroundColor:'#FFD11A', color:'#000', fontSize:11, fontWeight:800, borderRadius:20, padding:'3px 9px' }}>
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
          <Image src="/pato-icon.svg" alt="" width={22} height={22} />
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:6, padding:'0 16px 12px' }}>
          {([
            { key:'todos',     label:`Todos (${contratos.length})` },
            { key:'pendentes', label:'Pendentes' },
            { key:'assinados', label:'Assinados' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              height:28, borderRadius:20, padding:'0 12px',
              border:`1px solid ${filter===f.key ? '#FFD11A' : '#252525'}`,
              backgroundColor: filter===f.key ? '#FFD11A' : 'transparent',
              color: filter===f.key ? '#000' : '#666',
              fontSize:12, fontWeight:700, cursor:'pointer',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:32, height:32, border:'3px solid #222', borderTopColor:'#FFD11A', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'80px 24px', textAlign:'center' }}>
          <div style={{ color:'#2a2a2a', marginBottom:16 }}><IconDoc /></div>
          <p style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>
            {filter === 'pendentes' ? 'Nenhum contrato pendente' : filter === 'assinados' ? 'Nenhum contrato assinado' : 'Nenhum contrato ainda'}
          </p>
          <p style={{ fontSize:14, color:'#555', margin:0, lineHeight:1.5 }}>
            {filter === 'todos' ? 'Os contratos gerados pela IA aparecem aqui após você contratar um pato.' : 'Tudo em dia! ✅'}
          </p>
        </div>
      ) : (
        <div style={{ padding:'8px 0 32px' }}>
          {filtered.map(c => {
            const isContratante = c.contratante_id === userId
            const otherProfile  = isContratante ? c.prestador_profile : c.contratante_profile
            const myRole        = isContratante ? 'Contratante' : 'Prestador'
            const both          = c.assinado_contratante && c.assinado_prestador

            return (
              <div key={c.id}
                onClick={() => router.push(`/contrato/${c.id}`)}
                style={{ margin:'0 14px 10px', backgroundColor:'#141414', borderRadius:14, padding:'14px 16px', border:`1px solid ${both ? '#22C55E22' : '#1e1e1e'}`, cursor:'pointer' }}
              >
                {/* Top row */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, backgroundColor:'#1a0050', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:18 }}>📄</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:'0 0 2px', fontSize:14, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {c.posts?.title || 'Contrato'}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:'#555' }}>
                      {c.posts?.category && <span style={{ color:'#FFD11A', marginRight:6 }}>{c.posts.category}</span>}
                      {timeAgo(c.created_at)} · {myRole}
                    </p>
                  </div>
                  <StatusBadge c={c} userId={userId!} />
                </div>

                {/* Other party */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', backgroundColor:'#1a1a1a', borderRadius:10 }}>
                  {otherProfile && <Avatar p={otherProfile} size={28} />}
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:12, color:'#888' }}>
                      {isContratante ? 'Prestador' : 'Contratante'}
                    </p>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#ccc' }}>{otherProfile?.full_name || '–'}</p>
                  </div>

                  {/* Signatures mini status */}
                  <div style={{ display:'flex', gap:4 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', backgroundColor: c.assinado_contratante ? '#22C55E' : '#2a2a2a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>
                        {c.assinado_contratante ? '✓' : ''}
                      </div>
                      <p style={{ margin:'2px 0 0', fontSize:8, color:'#444' }}>C</p>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', backgroundColor: c.assinado_prestador ? '#22C55E' : '#2a2a2a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>
                        {c.assinado_prestador ? '✓' : ''}
                      </div>
                      <p style={{ margin:'2px 0 0', fontSize:8, color:'#444' }}>P</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
