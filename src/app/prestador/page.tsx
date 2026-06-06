'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import { useAuth } from '@/hooks/useAuth'
import { createPublicClient } from '@/lib/supabase/public'
import { validateMediaFile } from '@/lib/uploadGuard'
import AuthForm from '@/components/auth/AuthForm'

interface MsgMedia { kind: 'avatar' | 'portfolio' | 'audio'; url: string; type: 'image' | 'video' | 'audio' }
interface Msg { role: 'user' | 'assistant'; content: string; media?: MsgMedia }
interface ProfileData {
  nome: string; headline: string; skills: string[]; cidade: string; estado: string
  bio: string; whatsapp?: string; cpf?: string; rg?: string; regiao?: string
}

const GREETING = 'Oi! 👋 Que bom te ver por aqui. Me conta: o que você sabe fazer? Pode falar do seu jeito — qual serviço você oferece?'
const BUCKET = 'demand-media'
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export default function PrestadorPage() {
  const router = useRouter()
  const { profile: authProfile } = useAuth()
  const supabase = useRef(createPublicClient()).current

  // Optional return target (e.g. coming from "Me candidatar" on a pedido)
  const [next, setNext] = useState('/perfil')
  const skillSentRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const n = params.get('next')
    if (n) setNext(n)
    // Veio do chat do canto da landing (?skill=...) → já manda como 1ª mensagem.
    const skill = params.get('skill')
    if (skill && skill.trim() && !skillSentRef.current) {
      skillSentRef.current = true
      setTimeout(() => sendText(skill.trim()), 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }])
  const [input,    setInput]    = useState('')
  const [thinking, setThinking] = useState(false)
  const [options,  setOptions]  = useState<string[]>([])
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const pendingCreate = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Mídia coletada ao longo da conversa
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([])
  const [audioUrl,      setAudioUrl]      = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [recording,     setRecording]     = useState(false)
  const [recSeconds,    setRecSeconds]    = useState(0)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [mediaErr,      setMediaErr]      = useState('')
  const avatarInputRef    = useRef<HTMLInputElement>(null)
  const portfolioInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const audioChunksRef    = useRef<Blob[]>([])
  const recTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking, profileData])

  // ── Envia uma lista de mensagens para a IA e anexa a resposta ──
  async function sendMessages(updated: Msg[]) {
    setMessages(updated); setThinking(true); setOptions([])
    try {
      const res = await fetch('/api/onboarding-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })) }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'erro')
      if (json.reply) setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
      if (json.finished && json.profile) { setProfileData(json.profile as ProfileData); setOptions([]) }
      else setOptions(Array.isArray(json.options) ? json.options as string[] : [])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Tive um probleminha agora. Pode repetir sua última mensagem?' }])
    } finally {
      setThinking(false)
    }
  }

  // Envia um texto qualquer (digitado ou clicado numa opção)
  async function sendText(text: string) {
    const t = text.trim()
    if (!t || thinking || profileData || uploading) return
    await sendMessages([...messages, { role: 'user', content: t }])
  }

  async function send() {
    const text = input.trim()
    if (!text || thinking || profileData || uploading) return
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    await sendText(text)
  }

  // ── Upload genérico para o bucket público ──
  async function uploadToBucket(file: Blob, ext: string): Promise<string | null> {
    const path = `prestador/${Date.now()}-${uuid().slice(0, 6)}.${ext}`
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) { console.error('[prestador] upload', error); return null }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return publicUrl
  }

  // ── Foto de perfil ──
  async function handleAvatar(files: FileList) {
    const file = files[0]
    if (!file || thinking || uploading) return
    const invalid = validateMediaFile(file)
    if (invalid) { setMediaErr(invalid); return }
    setUploading(true)
    try {
      let up: Blob = file
      if (file.type.startsWith('image/')) up = await imageCompression(file, { maxSizeMB: 0.7, maxWidthOrHeight: 1024, useWebWorker: true })
      const url = await uploadToBucket(up, 'jpg')
      if (url) {
        setAvatarUrl(url)
        await sendMessages([...messages, { role: 'user', content: '[anexei: minha foto de perfil]', media: { kind: 'avatar', url, type: 'image' } }])
      }
    } finally { setUploading(false) }
  }

  // ── Portfólio (fotos / vídeos) ──
  async function handlePortfolio(files: FileList) {
    if (thinking || uploading) return
    const toAdd = Array.from(files).slice(0, 3)
    setUploading(true)
    const newMsgs: Msg[] = []
    const newUrls: string[] = []
    try {
      for (const file of toAdd) {
        const invalid = validateMediaFile(file)
        if (invalid) { setMediaErr(invalid); continue }
        const isVideo = file.type.startsWith('video')
        let up: Blob = file
        if (!isVideo) up = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
        const ext = isVideo ? (file.name.split('.').pop() ?? 'mp4') : 'jpg'
        const url = await uploadToBucket(up, ext)
        if (url) {
          newUrls.push(url)
          newMsgs.push({ role: 'user', content: `[anexei: ${isVideo ? 'vídeo' : 'foto'} de portfólio]`, media: { kind: 'portfolio', url, type: isVideo ? 'video' : 'image' } })
        }
      }
    } finally { setUploading(false) }
    if (newUrls.length) {
      setPortfolioUrls(prev => [...prev, ...newUrls])
      await sendMessages([...messages, ...newMsgs])
    }
  }

  // ── Áudio de apresentação ──
  function stopRecTimer() {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
  }

  async function toggleRecording() {
    if (thinking) return
    setMediaErr('')
    if (recording) { mediaRecorderRef.current?.stop(); return }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaErr('Seu navegador não permite gravar áudio aqui. Tente pelo Chrome.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Escolhe um formato suportado (Chrome=webm, Safari=mp4)
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported?.(m)) || ''
      const ext  = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
      const mr   = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        stopRecTimer(); setRecording(false); setRecSeconds(0)
        const blob = new Blob(audioChunksRef.current, { type: mime || 'audio/webm' })
        if (blob.size < 600) { setMediaErr('Gravação muito curta. Tente de novo.'); return }
        setUploading(true)
        try {
          const url = await uploadToBucket(blob, ext)
          if (url) {
            setAudioUrl(url)
            await sendMessages([...messages, { role: 'user', content: '[anexei: áudio de apresentação]', media: { kind: 'audio', url, type: 'audio' } }])
          } else {
            setMediaErr('Não consegui enviar o áudio. Tente de novo.')
          }
        } finally { setUploading(false) }
      }
      mr.start(); mediaRecorderRef.current = mr
      setRecording(true); setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => {
        if (s >= 119) { mr.stop(); return s } // limite ~2min
        return s + 1
      }), 1000)
    } catch (e) {
      console.error('[prestador] mic', e)
      setMediaErr('Não consegui acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  useEffect(() => () => stopRecTimer(), [])

  async function createProfile() {
    if (!profileData) return
    if (!authProfile?.id) { pendingCreate.current = true; setShowAuth(true); return }
    setCreating(true); setCreateErr('')
    try {
      // Server-side create (uses the auth cookie) — avoids the browser
      // session-client lock deadlock that would hang the write forever.
      const res  = await fetch('/api/create-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profileData, avatarUrl, portfolioUrls, audioUrl }),
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

  const busy = thinking || uploading

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
              maxWidth: '82%', padding: m.media ? '8px' : '11px 15px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#fff' : '#161616', color: m.role === 'user' ? '#000' : '#eee',
              fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.media ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.media.type === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.media.url} alt="" style={{ width: m.media.kind === 'avatar' ? 120 : 160, height: m.media.kind === 'avatar' ? 120 : 120, objectFit: 'cover', borderRadius: 10 }} />
                  )}
                  {m.media.type === 'video' && (
                    <video src={m.media.url} controls style={{ width: 200, borderRadius: 10 }} />
                  )}
                  {m.media.type === 'audio' && (
                    <audio src={m.media.url} controls style={{ width: 220 }} />
                  )}
                  <span style={{ fontSize: 11, color: m.role === 'user' ? '#888' : '#777', paddingLeft: 4 }}>
                    {m.media.kind === 'avatar' ? '📷 Foto de perfil' : m.media.kind === 'audio' ? '🎤 Áudio' : '🖼️ Portfólio'}
                  </span>
                </div>
              ) : m.content}
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '13px 16px', borderRadius: '16px 16px 16px 4px', background: '#161616', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#555', animation: `bounce 1.2s ${i * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Opções rápidas (quick replies estilo Claude) */}
        {options.length > 0 && !thinking && !profileData && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
            {options.map((opt, i) => (
              <button key={i} type="button" onClick={() => sendText(opt)} disabled={busy}
                style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.35)', borderRadius: 99, padding: '9px 16px', color: '#00d4ff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(0,212,255,0.16)' }}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.07)')}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Profile ready card */}
        {profileData && (
          <div style={{ background: '#0a1f14', border: '1px solid #1a4a2e', borderRadius: 14, padding: '20px', marginTop: 8 }}>
            <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>✓ Seu perfil está pronto</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid #1a4a2e', flexShrink: 0 }} />
                : <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>👤</div>}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{profileData.nome}</p>
                <p style={{ fontSize: 13, color: '#00d4ff', margin: 0 }}>{profileData.headline}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {profileData.skills.map((s, i) => (
                <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: '#111', border: '1px solid #222', borderRadius: 99, padding: '3px 10px' }}>{s}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 6px' }}>{profileData.bio}</p>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 4px' }}>📍 {profileData.cidade}{profileData.estado ? `, ${profileData.estado}` : ''}</p>
            {profileData.regiao && (
              <p style={{ fontSize: 12, color: '#555', margin: '0 0 10px' }}>🛣️ Atende: {profileData.regiao}</p>
            )}

            {/* Portfólio */}
            {portfolioUrls.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {portfolioUrls.map((u, i) => (
                  /\.(mp4|mov|webm)$/i.test(u)
                    ? <video key={i} src={u} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid #222' }} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img key={i} src={u} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid #222' }} />
                ))}
              </div>
            )}
            {audioUrl && <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 10 }} />}

            {/* Selo de verificação (CPF fica privado) */}
            {profileData.cpf && (
              <div style={{ margin: '0 0 14px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#2DD4BF', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 99, padding: '4px 11px', marginBottom: 6 }}>
                  ✓ Perfil verificado
                </span>
                <p style={{ fontSize: 12, color: '#22c55e', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔒 Seu CPF fica em sigilo — não aparece para ninguém.
                </p>
              </div>
            )}

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

      {/* Composer estilo ChatGPT/Claude */}
      {!profileData && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #111', padding: '10px 16px 16px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>

            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files) handleAvatar(e.target.files); e.target.value = '' }} />
            <input ref={portfolioInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" multiple style={{ display: 'none' }}
              onChange={e => { if (e.target.files) handlePortfolio(e.target.files); e.target.value = '' }} />

            {mediaErr && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>⚠ {mediaErr}</p>
            )}

            {/* Chips do que já foi anexado */}
            {(avatarUrl || portfolioUrls.length > 0 || audioUrl) && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {avatarUrl && <Chip icon="📷" label="Foto de perfil" />}
                {portfolioUrls.length > 0 && <Chip icon="🖼️" label={`Portfólio (${portfolioUrls.length})`} />}
                {audioUrl && <Chip icon="🎤" label="Áudio" />}
              </div>
            )}

            {/* Menu de anexo (popover do "+") */}
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', bottom: 60, left: 0, zIndex: 50, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 6, minWidth: 230, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                  <MenuItem icon="📷" title="Foto de perfil" sub="Uma foto do seu rosto" disabled={busy}
                    onClick={() => { setMenuOpen(false); avatarInputRef.current?.click() }} />
                  <MenuItem icon="🖼️" title="Fotos e vídeos" sub="Trabalhos do seu portfólio" disabled={busy}
                    onClick={() => { setMenuOpen(false); portfolioInputRef.current?.click() }} />
                </div>
              </>
            )}

            {/* Barra única arredondada */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: '#161616', border: `1px solid ${recording ? 'rgba(239,68,68,0.5)' : '#262626'}`, borderRadius: 26, padding: '7px 8px 7px 7px' }}>

              {/* Botão "+" de anexo */}
              <button type="button" onClick={() => { setMediaErr(''); setMenuOpen(o => !o) }} disabled={busy || recording}
                title="Anexar foto, vídeo ou portfólio"
                style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none', background: menuOpen ? '#2a2a2a' : 'transparent', color: busy ? '#444' : '#bbb', cursor: busy || recording ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s', transform: menuOpen ? 'rotate(45deg)' : 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>

              {recording ? (
                /* Estado de gravação */
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', height: 38 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'live-pulse 1.2s infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 13, color: '#777' }}>gravando áudio…</span>
                </div>
              ) : (
                <textarea ref={taRef} value={input} rows={1}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Escreva sua resposta…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14.5, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', overflow: 'hidden', padding: '8px 4px', minWidth: 0 }} />
              )}

              {/* Microfone */}
              <button type="button" onClick={toggleRecording} disabled={thinking || uploading}
                title={recording ? 'Parar gravação' : 'Gravar áudio'}
                style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none', background: recording ? '#ef4444' : 'transparent', color: recording ? '#fff' : (thinking || uploading ? '#444' : '#bbb'), cursor: thinking || uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {recording
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>}
              </button>

              {/* Enviar */}
              <button type="button" onClick={send} disabled={!input.trim() || busy || recording}
                style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none', background: input.trim() && !busy && !recording ? '#fff' : '#222', cursor: input.trim() && !busy && !recording ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {uploading
                  ? <span style={{ width: 15, height: 15, border: '2px solid #444', borderTopColor: '#999', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !busy && !recording ? '#000' : '#555'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 8 }}>
              Procurando contratar? <Link href="/" style={{ color: '#666' }}>Publicar um pedido →</Link>
            </p>
          </div>
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
        @keyframes live-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        textarea::placeholder { color: #555; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

/* Item do menu de anexo (popover do "+") */
function MenuItem({ icon, title, sub, onClick, disabled }: {
  icon: string; title: string; sub: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#262626' }}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      <span style={{ fontSize: 18, width: 32, height: 32, borderRadius: 8, background: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#eee' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#777' }}>{sub}</span>
      </span>
    </button>
  )
}

/* Chip do que já foi anexado */
function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 99, padding: '4px 10px' }}>
      <span>{icon}</span>{label}<span>✓</span>
    </span>
  )
}
