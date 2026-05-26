'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface BikoProfile {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  city: string | null
  category: string | null
  skills: string[] | null
  score: number
  seal: string | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  phone: string | null
  whatsapp_enabled: boolean | null
  source: 'biko'
}

interface GooglePlace {
  id: string
  name: string
  rating: number | null
  ratingCount: number
  address: string
  phone: string | null
  photoUrl: string | null
  photoCount: number
  websiteUrl: string | null
  isOpenNow: boolean | null
  scoreExterno: number
  source: 'google'
}

type SearchResult = BikoProfile | GooglePlace

/* ─── Helpers ─────────────────────────────────────────────── */
function toWhatsAppUrl(phone: string, name?: string): string {
  const digits = phone.replace(/\D/g, '')
  const number = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  const msg = encodeURIComponent(`Olá${name ? `, ${name}` : ''}! Encontrei seu negócio na Bikco e tenho interesse no seu serviço.`)
  return `https://wa.me/${number}?text=${msg}`
}

function scoreExternoLabel(score: number) {
  if (score >= 801) return { label: 'Top Bikco', icon: '🏆', color: '#FFD11A' }
  if (score >= 601) return { label: 'Destaque',  icon: '⭐', color: '#60A5FA' }
  if (score >= 301) return { label: 'Estabelecido', icon: '✅', color: '#22c55e' }
  return               { label: 'Iniciante',  icon: '🔰', color: '#9ca3af' }
}

function scoreExternoBarColor(score: number) {
  if (score >= 801) return 'linear-gradient(90deg, #FFD11A, #FF9500)'
  if (score >= 601) return 'linear-gradient(90deg, #3B82F6, #60A5FA)'
  if (score >= 301) return 'linear-gradient(90deg, #22c55e, #4ade80)'
  return 'linear-gradient(90deg, #6b7280, #9ca3af)'
}

async function captureLead(g: GooglePlace, action: 'ligar' | 'whatsapp') {
  const cidade = g.address.split(',').slice(-3, -2)[0]?.trim() ?? ''
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  }
  fetch('/api/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nome: g.name, telefone: g.phone, cidade,
      fonte: 'google', google_place_id: g.id,
      site_url: g.websiteUrl, score_externo: g.scoreExterno,
      avaliacao_google: g.rating, total_reviews: g.ratingCount, action,
    }),
  }).catch(e => console.error('[leads] captureLead error:', e))
}


function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()
}

/* ─── Cards ───────────────────────────────────────────────── */
function GoogleCard({ g }: { g: GooglePlace }) {
  const tier = scoreExternoLabel(g.scoreExterno)
  const barPct = Math.round((g.scoreExterno / 1000) * 100)

  return (
    <div style={{ background: '#2a2a2a', border: '1px solid #333', borderRadius: 16, overflow: 'hidden', flexShrink: 0, width: 260 }}>
      {/* Foto */}
      <div style={{ position: 'relative', height: 110, background: '#1a1a1a', overflow: 'hidden' }}>
        {g.photoUrl
          ? <img src={g.photoUrl} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🏢</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7))' }} />
        {g.isOpenNow != null && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: g.isOpenNow ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.85)', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff' }}>
            {g.isOpenNow ? '● Aberto' : '● Fechado'}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.8)', margin: 0 }}>{g.name}</p>
        </div>
      </div>

      <div style={{ padding: '12px 12px' }}>
        <p style={{ fontSize: 11, color: '#555', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {g.address}</p>

        {/* Rating + tier */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {g.rating != null && (
            <span style={{ background: '#333', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⭐ {g.rating.toFixed(1)} <span style={{ color: '#555', fontWeight: 400 }}>({g.ratingCount})</span></span>
          )}
          <span style={{ background: '#333', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: tier.color }}>{tier.icon} {tier.label}</span>
          {g.websiteUrl && (
            <a href={g.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>🌐</a>
          )}
        </div>

        {/* Score bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#444' }}>Score Bikco</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: tier.color }}>{g.scoreExterno}</span>
          </div>
          <div style={{ height: 3, background: '#333', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${barPct}%`, background: scoreExternoBarColor(g.scoreExterno), borderRadius: 99 }} />
          </div>
        </div>

        {g.phone && <div style={{ background: '#333', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#ddd' }}>📞 {g.phone}</div>}

        {g.phone ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { captureLead(g, 'ligar'); window.open(`tel:${g.phone}`, '_self') }}
              style={{ flex: 1, height: 34, borderRadius: 99, border: 'none', background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📞 Ligar</button>
            <button onClick={() => { captureLead(g, 'whatsapp'); window.open(toWhatsAppUrl(g.phone!, g.name), '_blank') }}
              style={{ flex: 1, height: 34, borderRadius: 99, border: 'none', background: '#25D366', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>WA</button>
          </div>
        ) : (
          <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.name + ' ' + g.address)}`, '_blank')}
            style={{ width: '100%', height: 34, borderRadius: 99, border: '1px solid #333', background: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>Ver no Maps</button>
        )}
      </div>
    </div>
  )
}

function BikoCard({ p, onView }: { p: BikoProfile; onView: () => void }) {
  return (
    <div style={{ background: '#2a2a2a', border: '1px solid #333', borderRadius: 16, padding: 14, flexShrink: 0, width: 260 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {p.avatar_url
          ? <img src={p.avatar_url} alt={p.full_name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #FFD11A, #FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#0a0a0a' }}>{initials(p.full_name)}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{[p.category, p.city].filter(Boolean).join(' · ')}</div>
        </div>
        <span style={{ background: 'rgba(255,209,26,0.1)', border: '1px solid rgba(255,209,26,0.2)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#FFD11A', flexShrink: 0, height: 'fit-content' }}>🦆 Bikco</span>
      </div>
      {p.phone && <div style={{ background: '#333', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontWeight: 600, color: '#ddd' }}>📞 {p.phone}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onView} style={{ flex: 1, height: 34, borderRadius: 99, border: '1px solid #444', background: 'none', color: '#ccc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver perfil</button>
        {p.phone && p.whatsapp_enabled
          ? <button onClick={() => window.open(toWhatsAppUrl(p.phone!), '_blank')} style={{ flex: 1, height: 34, borderRadius: 99, border: 'none', background: '#25D366', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>WA</button>
          : <button onClick={onView} style={{ flex: 1, height: 34, borderRadius: 99, border: 'none', background: 'linear-gradient(135deg, #FFD11A, #FF9500)', color: '#0a0a0a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Contatar</button>
        }
      </div>
    </div>
  )
}

/* ─── Mensagem de loading animado ─────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#2a2a2a', border: '1px solid #333', borderRadius: '4px 16px 16px 16px', width: 'fit-content' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FFD11A, #FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Image src="/pato-icon.svg" alt="Bikco" width={16} height={16} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFD11A', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 13, color: '#666' }}>Buscando profissionais…</span>
    </div>
  )
}

/* ─── Sugestões iniciais ──────────────────────────────────── */
const SUGGESTIONS = [
  { icon: '🎨', text: 'Pintor residencial perto de mim' },
  { icon: '⚡', text: 'Eletricista disponível hoje' },
  { icon: '🧹', text: 'Diarista para limpeza' },
  { icon: '🔧', text: 'Encanador urgente' },
  { icon: '❄️', text: 'Técnico de ar-condicionado' },
  { icon: '📚', text: 'Professor particular de inglês' },
]

/* ═══════════════════════════════════════════════════════════ */
/*  Chat turn                                                   */
/* ═══════════════════════════════════════════════════════════ */
interface Turn {
  query: string
  results: SearchResult[]
  loading: boolean
  cidade: string
}

/* ═══════════════════════════════════════════════════════════ */
/*  Main content                                               */
/* ═══════════════════════════════════════════════════════════ */
function ResultadosContent() {
  const router = useRouter()
  const params = useSearchParams()
  const qParam = params.get('q') ?? ''
  const cidadeParam = params.get('cidade') ?? ''

  const [turns,      setTurns]      = useState<Turn[]>([])
  const [input,      setInput]      = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [inputFocus, setInputFocus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  /* GPS silencioso */
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000 },
    )
  }, [])

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  /* Auto-resize textarea */
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  /* ── Search ─────────────────────────────────────────────── */
  const doSearch = useCallback(async (q: string, cidade: string, coords: typeof userCoords) => {
    if (!q.trim()) return
    const idx = Date.now()

    setTurns(prev => [...prev, { query: q, results: [], loading: true, cidade }])

    const supabase = createClient()

    // Supabase profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,bio,city,category,skills,score,seal,hourly_rate_min,hourly_rate_max,phone,whatsapp_enabled')
      .or(`full_name.ilike.%${q}%,bio.ilike.%${q}%,category.ilike.%${q}%`)
      .order('score', { ascending: false })
      .limit(10)

    const bikoResults: BikoProfile[] = (profiles ?? [])
      .filter(p => !cidade || (p.city ?? '').toLowerCase().includes(cidade.toLowerCase()))
      .map(p => ({ ...p, source: 'biko' as const }))

    let all: SearchResult[] = bikoResults

    // Google Places se menos de 5 biko
    if (bikoResults.length < 5) {
      try {
        const { data: { session: searchSession } } = await supabase.auth.getSession()
        const placesHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (searchSession?.access_token) placesHeaders['Authorization'] = `Bearer ${searchSession.access_token}`
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: placesHeaders,
          body: JSON.stringify({ query: q, city: cidade, lat: coords?.lat ?? 0, lng: coords?.lng ?? 0 }),
        })
        if (res.ok) {
          const data = await res.json()
          const googleResults: GooglePlace[] = (data.places ?? []).map(
            (p: Omit<GooglePlace, 'source'>) => ({ ...p, source: 'google' as const }),
          )
          all = [...bikoResults, ...googleResults]
        }
      } catch { /* silent */ }
    }

    setTurns(prev => prev.map((t, i) =>
      i === prev.length - 1 ? { ...t, results: all, loading: false } : t,
    ))
  }, [])

  /* Busca automática ao montar se há query na URL */
  useEffect(() => {
    if (qParam) doSearch(qParam, cidadeParam, userCoords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam, cidadeParam])

  /* Re-executa quando GPS chega e havia query mas sem resultados ainda */
  useEffect(() => {
    if (userCoords && qParam && turns.length === 0) {
      doSearch(qParam, cidadeParam, userCoords)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCoords])

  function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    doSearch(q, cidadeParam, userCoords)
    // Update URL sem recarregar
    const url = new URL(window.location.href)
    url.searchParams.set('q', q)
    window.history.pushState({}, '', url.toString())
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100dvh', background: '#212121',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#ececec',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(33,33,33,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 16px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Image src="/pato-icon.svg" alt="Bikco" width={18} height={18} />
          <span style={{ fontSize: 14, fontWeight: 800 }}>bikco<span style={{ color: '#FFD11A' }}>.com</span></span>
        </div>
        <div style={{ width: 32 }} />
      </header>

      {/* ── Chat area ── */}
      <main style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '24px 16px 180px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Empty state */}
        {turns.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', gap: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #FFD11A, #FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 0 40px rgba(255,209,26,0.15)' }}>
              <Image src="/pato-icon.svg" alt="Bikco" width={30} height={30} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>O que você precisa hoje?</h1>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 32 }}>Descreva o serviço e encontro o profissional certo</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, width: '100%', maxWidth: 520 }}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => send(s.text)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#303030'; e.currentTarget.style.borderColor = 'rgba(255,209,26,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                >
                  <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: '#aaa', lineHeight: 1.4 }}>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Turns */}
        {turns.map((turn, ti) => (
          <div key={ti} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* User message */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', maxWidth: '80%', fontSize: 15, color: '#ececec', lineHeight: 1.5 }}>
                {turn.query}
              </div>
            </div>

            {/* Biko response */}
            {turn.loading ? (
              <TypingDots />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header da resposta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FFD11A, #FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Image src="/pato-icon.svg" alt="" width={16} height={16} />
                  </div>
                  <span style={{ fontSize: 14, color: '#aaa', lineHeight: 1.5 }}>
                    {turn.results.length > 0
                      ? <>Encontrei <strong style={{ color: '#FFD11A' }}>{turn.results.length} profissiona{turn.results.length === 1 ? 'l' : 'is'}</strong> para <strong style={{ color: '#fff' }}>&quot;{turn.query}&quot;</strong>{turn.cidade ? ` em ${turn.cidade}` : ''}.</>
                      : <>Não encontrei profissionais para <strong>&quot;{turn.query}&quot;</strong>. Tente outros termos.</>
                    }
                  </span>
                </div>

                {/* Cards scroll horizontal */}
                {turn.results.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, paddingLeft: 38 }}>
                    {turn.results.map(r =>
                      r.source === 'biko'
                        ? <BikoCard key={r.id} p={r as BikoProfile} onView={() => router.push(`/profissional/${r.id}`)} />
                        : <GoogleCard key={r.id} g={r as GooglePlace} />,
                    )}
                  </div>
                )}

                {/* Sugestão de refinamento */}
                {turn.results.length > 0 && (
                  <div style={{ paddingLeft: 38, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {['Mostrar mais', 'Somente com foto', 'Melhor avaliados', 'Com WhatsApp'].map(s => (
                      <button key={s} onClick={() => send(`${turn.query} — ${s.toLowerCase()}`)}
                        style={{ height: 28, borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)', background: '#2a2a2a', color: '#666', fontSize: 12, cursor: 'pointer', padding: '0 12px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,209,26,0.2)'; e.currentTarget.style.color = '#FFD11A' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#666' }}
                      >{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </main>

      {/* ── Input fixo no rodapé ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, #212121 65%, transparent)', padding: '12px 16px 24px' }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          background: '#2f2f2f',
          border: `1px solid ${inputFocus ? 'rgba(255,209,26,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 14, padding: '8px 8px 8px 14px',
          display: 'flex', alignItems: 'flex-end', gap: 8,
          boxShadow: '0 -4px 32px rgba(0,0,0,0.3)',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setInputFocus(true)}
            onBlur={() => setInputFocus(false)}
            placeholder={turns.length > 0 ? 'Buscar outro profissional…' : 'Descreva o que você precisa…'}
            rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#ececec', fontSize: 15, lineHeight: 1.5, resize: 'none', maxHeight: 120, fontFamily: 'inherit', padding: '4px 0' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            style={{
              width: 36, height: 36, borderRadius: 9, border: 'none', flexShrink: 0,
              background: input.trim() ? '#FFD11A' : 'rgba(255,255,255,0.06)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#111' : '#444'} strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#2e2e2e', marginTop: 8 }}>
          Bikco pesquisa em profissionais cadastrados + Google Maps
        </p>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        textarea::placeholder { color: #444; }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #212121; }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function ResultadosPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#212121', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ResultadosContent />
    </Suspense>
  )
}
