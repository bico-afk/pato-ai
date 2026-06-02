'use client'

import { useState, useRef } from 'react'

interface Props {
  onSearch: (query: string, cidade: string) => void
  loading:  boolean
}

/* ── Pin icon ───────────────────────────────────────────────── */
function PinIcon({ spinning }: { spinning: boolean }) {
  if (spinning) return (
    <span style={{
      display: 'block', width: 16, height: 16,
      border: '2px solid #333', borderTopColor: '#00d4ff',
      borderRadius: '50%', animation: 'spin 0.9s linear infinite',
    }} />
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/* ── SearchBar ──────────────────────────────────────────────── */
export default function SearchBar({ onSearch, loading }: Props) {
  const [query,       setQuery]       = useState('')
  const [cidade,      setCidade]      = useState('')
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoError,    setGeoError]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── IA (Claude) — melhora o texto do pedido sob demanda ── */
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiError,      setAiError]      = useState('')

  async function refineWithAI() {
    const text = query.trim()
    if (text.length < 6 || aiLoading) return
    setAiLoading(true); setAiError(''); setAiSuggestion('')
    try {
      const res  = await fetch('/api/refine-demand', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'erro')
      setAiSuggestion(json.refined as string)
    } catch {
      setAiError('Não consegui melhorar agora. Tente de novo.')
    } finally {
      setAiLoading(false)
    }
  }

  /* Geolocation + reverse geocoding */
  async function detectLocation() {
    if (!navigator.geolocation) { setGeoError('Geolocalização não suportada'); return }
    setGeoLoading(true)
    setGeoError('')

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ?? ''
          if (key) {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&language=pt-BR&result_type=administrative_area_level_2&key=${key}`
            const res  = await fetch(url)
            const json = await res.json()
            const comp = json.results?.[0]?.address_components as Array<{long_name:string;short_name:string;types:string[]}>
            const city  = comp?.find(c => c.types.includes('administrative_area_level_2'))?.long_name ?? ''
            const state = comp?.find(c => c.types.includes('administrative_area_level_1'))?.long_name ?? ''
            const short = comp?.find(c => c.types.includes('administrative_area_level_1'))?.short_name ?? ''
            setCidade(city ? `${city}, ${short || state}` : `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`)
          } else {
            // Fallback: use coordinates as display
            setCidade(`${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`)
          }
        } catch {
          setCidade('Localização detectada')
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        setGeoLoading(false)
        setGeoError(err.code === 1 ? 'Permissão negada' : 'Não foi possível detectar localização')
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (query.trim()) onSearch(query.trim(), cidade.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {/* ── Main bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: '#111', border: '1px solid #333', borderRadius: 8,
        overflow: 'hidden', width: '100%',
      }}>

        {/* Geo button */}
        <button
          type="button"
          onClick={detectLocation}
          title="Detectar minha cidade"
          disabled={geoLoading}
          style={{
            flexShrink: 0, height: 56, width: 48,
            background: 'transparent', border: 'none',
            borderRight: '1px solid #1e1e1e',
            color: geoLoading ? '#00d4ff' : '#555',
            cursor: geoLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s',
          }}
        >
          <PinIcon spinning={geoLoading} />
        </button>

        {/* City field */}
        <input
          type="text"
          value={cidade}
          onChange={e => setCidade(e.target.value)}
          placeholder="Cidade"
          style={{
            flexShrink: 0, width: 140, height: 56,
            background: 'transparent', border: 'none',
            borderRight: '1px solid #1e1e1e',
            color: '#888', fontSize: 13, padding: '0 12px',
            outline: 'none',
          }}
        />

        {/* Query input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Ex: eletricista, pintor, frete, doceira..."
          autoFocus
          style={{
            flex: 1, height: 56, minWidth: 0,
            background: 'transparent', border: 'none',
            color: '#fff', fontSize: 15, padding: '0 16px',
            outline: 'none',
          }}
        />

        {/* Search button */}
        <button
          type="submit"
          disabled={!query.trim() || loading}
          style={{
            flexShrink: 0, height: 56, padding: '0 24px',
            background: query.trim() && !loading ? '#fff' : '#1a1a1a',
            border: 'none',
            color: query.trim() && !loading ? '#000' : '#333',
            fontSize: 14, fontWeight: 700,
            cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading
            ? <span style={{ width: 14, height: 14, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
            : 'Publicar'}
        </button>
      </div>

      {/* Geo error */}
      {geoError && (
        <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6, paddingLeft: 4 }}>{geoError}</p>
      )}

      {/* ── Melhorar com IA ── */}
      {query.trim().length >= 6 && (
        <div style={{ marginTop: 12 }}>
          {!aiSuggestion && (
            <button
              type="button"
              onClick={refineWithAI}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: 8, padding: '7px 12px',
                color: '#00d4ff', fontSize: 13, fontWeight: 600,
                cursor: aiLoading ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {aiLoading
                ? <span style={{ width: 13, height: 13, border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                : <span>✨</span>}
              {aiLoading ? 'Melhorando…' : 'Melhorar pedido com IA'}
            </button>
          )}

          {aiError && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{aiError}</p>
          )}

          {aiSuggestion && (
            <div style={{
              background: '#0b1a1f', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 10, padding: '14px 16px', marginTop: 4,
            }}>
              <p style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                ✨ Sugestão da IA
              </p>
              <p style={{ fontSize: 14, color: '#fff', lineHeight: 1.6, margin: '0 0 14px' }}>
                {aiSuggestion}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setQuery(aiSuggestion); setAiSuggestion(''); inputRef.current?.focus() }}
                  style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Usar este texto
                </button>
                <button
                  type="button"
                  onClick={() => setAiSuggestion('')}
                  style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Manter o meu
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Secondary links ── */}
      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <a href="/feed" style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          Quero oferecer um serviço →
        </a>
        <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          Prefiro pelo WhatsApp →
        </a>
      </div>

      {/* Mobile styles */}
      <style>{`
        @media (max-width: 600px) {
          form > div:first-child {
            flex-wrap: wrap;
            border-radius: 8px;
          }
          form > div:first-child input[placeholder="Cidade"] {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #1e1e1e;
          }
          form > div:first-child input[placeholder*="eletricista"] {
            border-bottom: 1px solid #1e1e1e;
          }
          form > div:first-child button[type="submit"] {
            width: 100% !important;
            border-radius: 0 0 6px 6px;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}
