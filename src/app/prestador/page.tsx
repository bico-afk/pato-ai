'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import AuthForm from '@/components/auth/AuthForm'

interface Msg { role: 'user' | 'assistant'; content: string }
interface ProfileData {
  nome: string; headline: string; skills: string[]; cidade: string; estado: string; bio: string
}

const GREETING = 'Oi! 👋 Que bom te ver por aqui. Me conta: o que você sabe fazer? Pode falar do seu jeito — qual serviço você oferece?'

export default function PrestadorPage() {
  const router = useRouter()
  const { profile: authProfile } = useAuth()

  // Optional return target (e.g. coming from "Me candidatar" on a pedido)
  const [next, setNext] = useState('/perfil')
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next')
    if (n) setNext(n)
  }, [])

  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }])
  const [input,    setInput]    = useState('')
  const [thinking, setThinking] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const pendingCreate = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking, profileData])

  async function send() {
    const text = input.trim()
    if (!text || thinking || profileData) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setThinking(true)
    if (taRef.current) taRef.current.style.height = 'auto'
    try {
      const res = await fetch('/api/onboarding-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'erro')
      if (json.reply) setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
      if (json.finished && json.profile) setProfileData(json.profile as ProfileData)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Tive um probleminha agora. Pode repetir sua última mensagem?' }])
    } finally {
      setThinking(false)
    }
  }

  async function createProfile() {
    if (!profileData) return
    if (!authProfile?.id) { pendingCreate.current = true; setShowAuth(true); return }
    setCreating(true); setCreateErr('')
    try {
      // Server-side create (uses the auth cookie) — avoids the browser
      // session-client lock deadlock that would hang the write forever.
      const res  = await fetch('/api/create-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'erro')
      router.push(next)
    } catch (e) {
      console.error('[prestador] create profile', e)
      setCreateErr('Não foi possível criar agora. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  // After login, finish creating automatically
  useEffect(() => {
    if (pendingCreate.current && authProfile?.id && profileData) {
      pendingCreate.current = false
      setShowAuth(false)
      createProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfile, profileData])

  return (
    <div style={{ height: 'calc(100dvh - 52px)', background: '#000', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid #111', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>Criar meu perfil de profissional</p>
        <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>Converse com a IA — ela monta seu perfil pra você</p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '82%', padding: '11px 15px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#fff' : '#161616', color: m.role === 'user' ? '#000' : '#eee',
              fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{m.content}</div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '13px 16px', borderRadius: '16px 16px 16px 4px', background: '#161616', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#555', animation: `bounce 1.2s ${i * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Profile ready card */}
        {profileData && (
          <div style={{ background: '#0a1f14', border: '1px solid #1a4a2e', borderRadius: 14, padding: '20px', marginTop: 8 }}>
            <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>✓ Seu perfil está pronto</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{profileData.nome}</p>
            <p style={{ fontSize: 13, color: '#00d4ff', margin: '0 0 10px' }}>{profileData.headline}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {profileData.skills.map((s, i) => (
                <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: '#111', border: '1px solid #222', borderRadius: 99, padding: '3px 10px' }}>{s}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 6px' }}>{profileData.bio}</p>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 16px' }}>📍 {profileData.cidade}{profileData.estado ? `, ${profileData.estado}` : ''}</p>

            {createErr && <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 10px' }}>{createErr}</p>}

            <button onClick={createProfile} disabled={creating}
              style={{ width: '100%', height: 50, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontSize: 15, fontWeight: 800, cursor: creating ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {creating
                ? <span style={{ width: 18, height: 18, border: '2px solid #ccc', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                : (authProfile?.id ? 'Criar meu perfil grátis' : 'Criar conta e finalizar perfil')}
            </button>
            <button onClick={() => setProfileData(null)} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Ajustar algo na conversa
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!profileData && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #111', padding: '12px 16px 20px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '10px 14px' }}>
              <textarea ref={taRef} value={input} rows={1}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Escreva sua resposta…"
                style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14.5, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', overflow: 'hidden' }} />
            </div>
            <button onClick={send} disabled={!input.trim() || thinking}
              style={{ width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0, background: input.trim() ? '#fff' : '#111', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#000' : '#444'} strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 8 }}>
            Procurando contratar? <Link href="/" style={{ color: '#666' }}>Publicar um pedido →</Link>
          </p>
        </div>
      )}

      {/* Auth modal */}
      {showAuth && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 999 }}>
          <div style={{ width: '100%', maxWidth: 400, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: '36px 28px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Quase lá!</h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>Crie sua conta para publicar seu perfil e receber bicos.</p>
            <AuthForm onSuccess={() => setShowAuth(false)} redirectTo={`/prestador?next=${encodeURIComponent(next)}`} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); opacity:0.4 } 40% { transform: translateY(-5px); opacity:1 } }
        textarea::placeholder { color: #555; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
