'use client'

import { useState, useRef, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { createPublicClient } from '@/lib/supabase/public'
import type { LocationData } from '@/lib/geo'

interface Props {
  onSearch: (query: string, location: LocationData | null, mediaUrls: string[]) => void
  loading:  boolean
}

interface Suggestion { placeId: string; main: string; sub: string }
interface MediaItem  { id: string; preview: string; type: 'image' | 'video'; uploading: boolean; url?: string; error?: boolean }

const BUCKET = 'demand-media'
const MAX_FILES = 3
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

/* ── Pin icon ───────────────────────────────────────────────── */
function PinIcon({ spinning }: { spinning: boolean }) {
  if (spinning) return (
    <span style={{ display: 'block', width: 16, height: 16, border: '2px solid #333', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/* ── SearchBar ──────────────────────────────────────────────── */
export default function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabaseRef = useRef(createPublicClient())
  const supabase = supabaseRef.current

  /* ── Address autocomplete ── */
  const [addr,        setAddr]        = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDrop,    setShowDrop]    = useState(false)
  const [location,    setLocation]    = useState<LocationData | null>(null)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const sessionTokenRef = useRef(uuid())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typedRef = useRef(true) // false when addr changed from a selection / GPS (not typing)

  // Fetch suggestions as the user types (debounced)
  useEffect(() => {
    if (!typedRef.current) return // change came from selecting a suggestion — don't re-open
    if (addr.trim().length < 3) { setSuggestions([]); setShowDrop(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/geo/autocomplete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: addr.trim(), sessionToken: sessionTokenRef.current }),
        })
        const json = await res.json()
        setSuggestions(json.suggestions ?? [])
        setShowDrop((json.suggestions ?? []).length > 0)
      } catch { setSuggestions([]) }
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [addr])

  async function selectSuggestion(s: Suggestion) {
    typedRef.current = false
    setShowDrop(false); setSuggestions([]); setGeoLoading(true)
    setAddr(`${s.main}${s.sub ? ', ' + s.sub : ''}`)
    try {
      const res = await fetch('/api/geo/details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: s.placeId, sessionToken: sessionTokenRef.current }),
      })
      const json = await res.json()
      if (json.ok) {
        setLocation(json.details as LocationData)
        setAddr((json.details as LocationData).formatted)
      }
    } catch { /* ignore */ }
    finally { setGeoLoading(false); sessionTokenRef.current = uuid() }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return
    typedRef.current = false
    setGeoLoading(true); setShowDrop(false); setSuggestions([])
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch('/api/geo/reverse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
        })
        const json = await res.json()
        if (json.ok) { setLocation(json.details as LocationData); setAddr((json.details as LocationData).formatted) }
      } catch { /* ignore */ }
      finally { setGeoLoading(false) }
    }, () => setGeoLoading(false), { timeout: 8000, maximumAge: 60_000 })
  }

  /* ── Media (fotos / vídeos) ── */
  const [medias, setMedias] = useState<MediaItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    const remaining = MAX_FILES - medias.length
    const toAdd = Array.from(files).slice(0, remaining)
    for (const file of toAdd) {
      const id = uuid()
      const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image'
      setMedias(prev => [...prev, { id, preview: URL.createObjectURL(file), type, uploading: true }])
      try {
        let upload: File = file
        if (file.type.startsWith('image/')) {
          upload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
        }
        const ext  = file.name.split('.').pop() ?? 'bin'
        const path = `${Date.now()}-${uuid().slice(0, 6)}.${ext}`
        const { data, error } = await supabase.storage.from(BUCKET).upload(path, upload, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
        setMedias(prev => prev.map(m => m.id === id ? { ...m, uploading: false, url: publicUrl } : m))
      } catch (e) {
        console.error('[SearchBar] upload', e)
        setMedias(prev => prev.map(m => m.id === id ? { ...m, uploading: false, error: true } : m))
      }
    }
  }

  function removeMedia(id: string) { setMedias(prev => prev.filter(m => m.id !== id)) }

  /* ── IA (Claude) — melhora o texto do pedido ── */
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiError,      setAiError]      = useState('')

  async function refineWithAI() {
    const text = query.trim()
    if (text.length < 6 || aiLoading) return
    setAiLoading(true); setAiError(''); setAiSuggestion('')
    try {
      const res  = await fetch('/api/refine-demand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'erro')
      setAiSuggestion(json.refined as string)
    } catch { setAiError('Não consegui melhorar agora. Tente de novo.') }
    finally { setAiLoading(false) }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return
    const urls = medias.filter(m => m.url).map(m => m.url as string)
    onSearch(query.trim(), location, urls)
  }

  const canSubmit = query.trim().length > 0 && !loading && medias.every(m => !m.uploading)

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', position: 'relative' }}>
      {/* ── Main bar ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#111', border: '1px solid #333', borderRadius: 8, overflow: 'hidden', width: '100%' }}>

        {/* Address field + autocomplete */}
        <div style={{ position: 'relative', flexShrink: 0, width: 220, borderRight: '1px solid #1e1e1e', display: 'flex', alignItems: 'center' }}>
          <button type="button" onClick={useMyLocation} title="Usar minha localização"
            style={{ flexShrink: 0, height: 56, width: 40, background: 'transparent', border: 'none', color: geoLoading ? '#00d4ff' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PinIcon spinning={geoLoading} />
          </button>
          <input
            type="text"
            value={addr}
            onChange={e => { typedRef.current = true; setAddr(e.target.value); setLocation(null) }}
            onFocus={() => suggestions.length && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Seu endereço"
            style={{ flex: 1, minWidth: 0, height: 56, background: 'transparent', border: 'none', color: location ? '#00d4ff' : '#aaa', fontSize: 13, padding: '0 8px 0 0', outline: 'none' }}
          />
        </div>

        {/* Query input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Ex: eletricista, pintor, frete, doceira..."
          autoFocus
          style={{ flex: 1, height: 56, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', fontSize: 15, padding: '0 16px', outline: 'none' }}
        />

        {/* Submit */}
        <button type="submit" disabled={!canSubmit}
          style={{ flexShrink: 0, height: 56, padding: '0 24px', background: canSubmit ? '#fff' : '#1a1a1a', border: 'none', color: canSubmit ? '#000' : '#333', fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading
            ? <span style={{ width: 14, height: 14, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
            : 'Publicar'}
        </button>
      </div>

      {/* Address suggestions — rendered OUTSIDE the bar so overflow:hidden can't clip it */}
      {showDrop && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: 60, left: 0, width: 380, maxWidth: '100%', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 10, zIndex: 60, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.75)' }}>
          {suggestions.map(s => (
            <button key={s.placeId} type="button" onMouseDown={() => selectSuggestion(s)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <span style={{ display: 'block', fontSize: 13, color: '#fff', fontWeight: 600 }}>📍 {s.main}</span>
              {s.sub && <span style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 2 }}>{s.sub}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Privacy note */}
      <p style={{ fontSize: 12, color: '#666', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.5 }}>
        <span style={{ flexShrink: 0 }}>🔒</span>
        Não se preocupe — seu endereço é totalmente anônimo. Deixamos visível apenas a sua <strong style={{ color: '#999', fontWeight: 600 }}>cidade</strong>.
      </p>

      {/* ── Fotos / vídeos ── */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {medias.map(m => (
          <div key={m.id} style={{ position: 'relative', width: 56, height: 56 }}>
            {m.type === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={m.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }} />
              : <video src={m.preview} muted style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }} />}
            {m.uploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 16, height: 16, border: '2px solid #333', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
            {m.error && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.35)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', textAlign: 'center', padding: 2 }}>erro</div>
            )}
            <button type="button" onClick={() => removeMedia(m.id)}
              style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        ))}
        {medias.length < MAX_FILES && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed #333', borderRadius: 8, color: '#666', fontSize: 13, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#999' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#666' }}>
              📎 Adicionar foto ou vídeo
            </button>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov" multiple style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)} />
          </>
        )}
      </div>

      {/* ── Melhorar com IA ── */}
      {query.trim().length >= 6 && (
        <div style={{ marginTop: 12 }}>
          {!aiSuggestion && (
            <button type="button" onClick={refineWithAI} disabled={aiLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, padding: '7px 12px', color: '#00d4ff', fontSize: 13, fontWeight: 600, cursor: aiLoading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {aiLoading
                ? <span style={{ width: 13, height: 13, border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                : <span>✨</span>}
              {aiLoading ? 'Melhorando…' : 'Melhorar pedido com IA'}
            </button>
          )}
          {aiError && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{aiError}</p>}
          {aiSuggestion && (
            <div style={{ background: '#0b1a1f', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
              <p style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>✨ Sugestão da IA</p>
              <p style={{ fontSize: 14, color: '#fff', lineHeight: 1.6, margin: '0 0 14px' }}>{aiSuggestion}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setQuery(aiSuggestion); setAiSuggestion(''); inputRef.current?.focus() }}
                  style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Usar este texto</button>
                <button type="button" onClick={() => setAiSuggestion('')}
                  style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Manter o meu</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Secondary links ── */}
      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <a href="/prestador" style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          Quero oferecer um serviço →
        </a>
        <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          Prefiro pelo WhatsApp →
        </a>
      </div>

      <style>{`
        @media (max-width: 600px) {
          form > div:first-child { flex-wrap: wrap; }
          form > div:first-child > div:first-child { width: 100% !important; border-right: none !important; border-bottom: 1px solid #1e1e1e; }
          form > div:first-child input[placeholder*="eletricista"] { border-bottom: 1px solid #1e1e1e; width: 100%; }
          form > div:first-child button[type="submit"] { width: 100% !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}
