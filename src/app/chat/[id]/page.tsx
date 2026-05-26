'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface Conversa {
  id: string; post_id: string | null
  user1_id: string; user2_id: string
  status: string; valor_combinado: number | null
}
interface Mensagem {
  id: string; conversa_id: string; sender_id: string
  content: string; type: 'text' | 'image' | 'system'
  photo_url: string | null; created_at: string
}
interface OtherUser { id: string; full_name: string; avatar_url: string | null }
interface PostInfo  { id: string; title: string }

/* ─── Helpers ─────────────────────────────────────────────── */
const initials = (n: string) => n.split(' ').slice(0,2).map(w=>w[0]??'').join('').toUpperCase()
const fmtTime  = (d: string) => new Date(d).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
const fmtDay   = (d: string) => {
  const t = new Date(d), now = new Date()
  const yest = new Date(now); yest.setDate(yest.getDate()-1)
  if (t.toDateString()===now.toDateString())  return 'Hoje'
  if (t.toDateString()===yest.toDateString()) return 'Ontem'
  return t.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
}

/* ─── Bubble ──────────────────────────────────────────────── */
function Bubble({ msg, isMe, other }: { msg: Mensagem; isMe: boolean; other: OtherUser | null }) {
  if (msg.type === 'system') return (
    <div style={{display:'flex',justifyContent:'center',margin:'6px 0'}}>
      <span style={{background:'#1e1e1e',color:'#666',fontSize:12,borderRadius:99,padding:'3px 12px'}}>{msg.content}</span>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:isMe?'row-reverse':'row',alignItems:'flex-end',gap:6,marginBottom:8}}>
      {!isMe && (
        other?.avatar_url
          ? <img src={other.avatar_url} alt="" style={{width:26,height:26,borderRadius:8,objectFit:'cover',flexShrink:0,border:'1px solid #2a2a2a'}}/>
          : <div style={{width:26,height:26,borderRadius:8,flexShrink:0,background:'#222',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#FFD11A'}}>{other?initials(other.full_name):'?'}</div>
      )}
      <div style={{maxWidth:'72%',display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:2}}>
        {msg.type==='image'&&msg.photo_url&&(
          <img src={msg.photo_url} alt="" style={{maxWidth:'100%',maxHeight:200,objectFit:'cover',borderRadius:12}}/>
        )}
        {msg.content&&(
          <div style={{padding:'9px 13px',background:isMe?'#FFD11A':'#1e1e1e',color:isMe?'#0f0f0f':'#fff',borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',fontSize:14,lineHeight:1.45,wordBreak:'break-word'}}>
            {msg.content}
          </div>
        )}
        <span style={{fontSize:10,color:'#444'}}>{fmtTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const rawId  = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [conv,         setConv]         = useState<Conversa | null>(null)
  const [other,        setOther]        = useState<OtherUser | null>(null)
  const [post,         setPost]         = useState<PostInfo | null>(null)
  const [messages,     setMessages]     = useState<Mensagem[]>([])
  const [meId,         setMeId]         = useState<string | null>(null)
  const [newMsg,       setNewMsg]       = useState('')
  const [sending,      setSending]      = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [status,       setStatus]       = useState<'loading'|'error'|'ok'>('loading')
  const [dealValue,    setDealValue]    = useState('')
  const [showDeal,     setShowDeal]     = useState(false)
  const [toast,        setToast]        = useState('')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef  = useRef<any>(null)

  const toast$ = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''), 3000) }

  /* ── Auto-scroll ── */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  /* ── Init — todas as queries em paralelo ── */
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      setMeId(uid)

      /* 1 — Resolve conversa */
      const { data: byId } = await supabase.from('conversas').select('*').eq('id', rawId).maybeSingle()
      let cv: Conversa | null = null

      if (byId) {
        if (byId.user1_id !== uid && byId.user2_id !== uid) { setStatus('error'); return }
        cv = byId as Conversa
      } else {
        const { data: existing } = await supabase.from('conversas').select('*')
          .or(`and(user1_id.eq.${uid},user2_id.eq.${rawId}),and(user1_id.eq.${rawId},user2_id.eq.${uid})`)
          .maybeSingle()
        if (existing) {
          cv = existing as Conversa
        } else {
          const { data: created } = await supabase.from('conversas')
            .insert({ user1_id: uid, user2_id: rawId, status: 'ativa' }).select().single()
          if (created) cv = created as Conversa
        }
      }

      if (!cv) { setStatus('error'); return }
      setConv(cv)

      /* 2 — Busca tudo em paralelo */
      const otherId = cv.user1_id === uid ? cv.user2_id : cv.user1_id
      const [profileRes, postRes, msgsRes] = await Promise.all([
        supabase.from('profiles').select('id,full_name,avatar_url').eq('id', otherId).single(),
        cv.post_id ? supabase.from('posts').select('id,title').eq('id', cv.post_id).single() : Promise.resolve({ data: null }),
        supabase.from('mensagens').select('*').eq('conversa_id', cv.id).order('created_at', { ascending: false }).limit(60),
      ])

      if (profileRes.data) setOther(profileRes.data as OtherUser)
      if (postRes.data)    setPost(postRes.data as PostInfo)
      if (msgsRes.data)    setMessages([...msgsRes.data].reverse() as Mensagem[])

      setStatus('ok')

      /* 3 — Realtime */
      channelRef.current = supabase
        .channel(`chat-${cv.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${cv.id}` },
          (payload: { new: Mensagem }) => {
            const m = payload.new
            setMessages(prev => prev.some(x=>x.id===m.id) ? prev : [...prev, m])
          })
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversas', filter: `id=eq.${cv.id}` },
          (payload: { new: Partial<Conversa> }) => {
            setConv(prev => prev ? { ...prev, ...payload.new } : prev)
          })
        .subscribe()
    }

    init()
    return () => { if (channelRef.current) createClient().removeChannel(channelRef.current) }
  }, [rawId, router])

  /* ── Send text ── */
  const send = useCallback(async () => {
    const text = newMsg.trim()
    if (!text || sending || !conv || !meId) return
    setSending(true)
    setNewMsg('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const supabase = createClient()
    const optimistic: Mensagem = {
      id: `tmp-${Date.now()}`, conversa_id: conv.id, sender_id: meId,
      content: text, type: 'text', photo_url: null, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { data: inserted, error } = await supabase
      .from('mensagens').insert({ conversa_id: conv.id, sender_id: meId, content: text, type: 'text' })
      .select().single()

    if (error || !inserted) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setNewMsg(text)
    } else {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? inserted as Mensagem : m))
    }
    setSending(false)
  }, [newMsg, sending, conv, meId])

  /* ── Send photo ── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !conv || !meId) return
    if (file.size > 10 * 1024 * 1024) { toast$('❌ Máximo 10MB'); return }
    setUploading(true)
    const supabase = createClient()
    const path = `${conv.id}/${Date.now()}.${file.name.split('.').pop()}`
    const { data: up, error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false })
    if (upErr) { toast$('❌ Erro ao enviar imagem'); }
    else if (up) {
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(up.path)
      await supabase.from('mensagens').insert({ conversa_id: conv.id, sender_id: meId, content: '', type: 'image', photo_url: publicUrl })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  /* ── Close deal ── */
  async function closeDeal() {
    const valor = parseFloat(dealValue)
    if (!valor || !conv || !meId) return
    setShowDeal(false)
    const supabase = createClient()
    await supabase.from('conversas').update({ status: 'acordo_fechado', valor_combinado: valor }).eq('id', conv.id)
    await supabase.from('mensagens').insert({ conversa_id: conv.id, sender_id: meId, content: `🤝 Acordo fechado — R$ ${valor.toFixed(2).replace('.',',')}`, type: 'system' })
    setConv(prev => prev ? { ...prev, status: 'acordo_fechado', valor_combinado: valor } : prev)
    setDealValue('')
    toast$('✅ Acordo registrado!')
  }

  /* ─── Loading / Error ─────────────────────────────────── */
  if (status === 'loading') return (
    <div style={{minHeight:'100dvh',background:'#0f0f0f',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'3px solid #1e1e1e',borderTopColor:'#FFD11A',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (status === 'error') return (
    <div style={{minHeight:'100dvh',background:'#0f0f0f',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,color:'#fff',fontFamily:'Inter,sans-serif'}}>
      <span style={{fontSize:40}}>💬</span>
      <p style={{fontSize:15,fontWeight:700}}>Conversa não encontrada</p>
      <button onClick={()=>router.back()} style={{height:44,borderRadius:99,border:'none',background:'#FFD11A',color:'#0f0f0f',fontWeight:800,cursor:'pointer',padding:'0 24px',fontSize:14}}>← Voltar</button>
    </div>
  )

  const dealClosed = conv?.status === 'acordo_fechado'

  /* ─── Group by date ───────────────────────────────────── */
  const grouped: { date: string; msgs: Mensagem[] }[] = []
  for (const m of messages) {
    const d = fmtDay(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  }

  /* ─────────────────────────────────────────────────────── */
  return (
    <div style={{height:'100dvh',background:'#0f0f0f',fontFamily:'Inter,system-ui,sans-serif',color:'#fff',display:'flex',flexDirection:'column',overflow:'hidden'}}>

      {/* ── HEADER ── */}
      <header style={{flexShrink:0,background:'rgba(10,10,10,0.97)',backdropFilter:'blur(12px)',borderBottom:'1px solid #1a1a1a',padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>router.back()} style={{background:'none',border:'none',color:'#666',cursor:'pointer',padding:4,display:'flex',flexShrink:0}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>

        {other?.avatar_url
          ? <img src={other.avatar_url} alt="" style={{width:36,height:36,borderRadius:10,objectFit:'cover',border:'1px solid #2a2a2a',flexShrink:0}}/>
          : <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:'#222',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#FFD11A'}}>{other?initials(other.full_name):'?'}</div>
        }

        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:14,fontWeight:700,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{other?.full_name??'...'}</p>
          {post&&<p style={{fontSize:11,color:'#555',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📋 {post.title}</p>}
        </div>

        {dealClosed && (
          <span style={{fontSize:11,color:'#22c55e',fontWeight:700,flexShrink:0,background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:99,padding:'3px 10px'}}>
            ✓ Acordo
          </span>
        )}
        {!dealClosed && (
          <button onClick={()=>setShowDeal(v=>!v)} style={{flexShrink:0,height:32,borderRadius:99,border:'1px solid #2a2a2a',background:'#1a1a1a',color:'#888',fontSize:12,fontWeight:700,cursor:'pointer',padding:'0 12px'}}>
            Acordo
          </button>
        )}
      </header>

      {/* ── DEAL INLINE PANEL ── */}
      {showDeal && !dealClosed && (
        <div style={{flexShrink:0,background:'#141414',borderBottom:'1px solid #222',padding:'12px 14px',display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:13,color:'#888',flexShrink:0}}>R$</span>
          <input
            type="number" placeholder="Valor combinado" value={dealValue} onChange={e=>setDealValue(e.target.value)}
            autoFocus
            style={{flex:1,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:14,outline:'none'}}
          />
          <button onClick={closeDeal} disabled={!dealValue} style={{height:38,borderRadius:10,border:'none',background:dealValue?'linear-gradient(135deg,#FFD11A,#FF9500)':'#2a2a2a',color:dealValue?'#0f0f0f':'#555',fontWeight:800,fontSize:13,cursor:dealValue?'pointer':'not-allowed',padding:'0 16px',flexShrink:0}}>
            Confirmar ✅
          </button>
          <button onClick={()=>setShowDeal(false)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:18,lineHeight:1,padding:4,flexShrink:0}}>✕</button>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 14px 0',maxWidth:520,width:'100%',margin:'0 auto',alignSelf:'stretch'}}>

        {messages.length===0&&(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 0',textAlign:'center',gap:12}}>
            <span style={{fontSize:44}}>💬</span>
            <p style={{fontSize:14,color:'#555',margin:0}}>Inicie a conversa!</p>
          </div>
        )}

        {grouped.map(g => (
          <div key={g.date}>
            <div style={{display:'flex',alignItems:'center',gap:8,margin:'14px 0 10px'}}>
              <div style={{flex:1,height:1,background:'#1e1e1e'}}/>
              <span style={{fontSize:11,color:'#444'}}>{g.date}</span>
              <div style={{flex:1,height:1,background:'#1e1e1e'}}/>
            </div>
            {g.msgs.map(m => <Bubble key={m.id} msg={m} isMe={m.sender_id===meId} other={other}/>)}
          </div>
        ))}

        {dealClosed&&conv?.valor_combinado!=null&&(
          <div style={{margin:'16px 0',background:'rgba(34,197,94,0.07)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:14,padding:'14px',textAlign:'center'}}>
            <p style={{fontSize:13,fontWeight:800,color:'#22c55e',margin:'0 0 4px'}}>🤝 Acordo fechado</p>
            <p style={{fontSize:22,fontWeight:900,margin:0}}>R$ {conv.valor_combinado.toFixed(2).replace('.',',')}</p>
          </div>
        )}

        <div ref={bottomRef} style={{height:8}}/>
      </div>

      {/* ── INPUT BAR ── */}
      <div style={{flexShrink:0,background:'rgba(10,10,10,0.97)',backdropFilter:'blur(12px)',borderTop:'1px solid #1a1a1a',padding:'10px 14px 20px'}}>
        <div style={{maxWidth:520,margin:'0 auto',display:'flex',alignItems:'flex-end',gap:8}}>

          <button onClick={()=>fileRef.current?.click()} disabled={uploading}
            style={{width:40,height:40,borderRadius:11,border:'1px solid #2a2a2a',background:'#1a1a1a',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {uploading
              ? <div style={{width:14,height:14,border:'2px solid #333',borderTopColor:'#FFD11A',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/></svg>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:'none'}}/>

          <div style={{flex:1,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:12,padding:'9px 12px',display:'flex',alignItems:'flex-end'}}>
            <textarea ref={textareaRef} value={newMsg}
              onChange={e=>{ setNewMsg(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px' }}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              placeholder="Mensagem..." rows={1}
              style={{flex:1,background:'none',border:'none',outline:'none',color:'#fff',fontSize:14,lineHeight:1.5,resize:'none',fontFamily:'inherit',overflow:'hidden'}}
            />
          </div>

          <button onClick={send} disabled={!newMsg.trim()||sending}
            style={{width:40,height:40,borderRadius:11,border:'none',flexShrink:0,background:newMsg.trim()?'linear-gradient(135deg,#FFD11A,#FF9500)':'#1a1a1a',cursor:newMsg.trim()?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
            {sending
              ? <div style={{width:14,height:14,border:'2.5px solid rgba(0,0,0,0.2)',borderTopColor:'#0f0f0f',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={newMsg.trim()?'#0f0f0f':'#444'} strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast&&(
        <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:99,padding:'9px 20px',fontSize:13,fontWeight:600,zIndex:500,whiteSpace:'nowrap',animation:'toastIn 0.2s ease'}}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        textarea::placeholder { color: #444; }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
