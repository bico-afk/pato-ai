'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter }                    from 'next/navigation'
import Image                            from 'next/image'
import { createClient }                 from '@/lib/supabase'

/* ─── Constants ───────────────────────────────────────────── */
const CATEGORIES = [
  { icon: '⚡', label: 'Elétrica' },
  { icon: '🔧', label: 'Encanamento' },
  { icon: '🎨', label: 'Pintura' },
  { icon: '🧹', label: 'Limpeza' },
  { icon: '🏗️', label: 'Reformas' },
  { icon: '📚', label: 'Aulas' },
  { icon: '💻', label: 'Informática' },
  { icon: '🌿', label: 'Jardim' },
  { icon: '✂️', label: 'Beleza' },
  { icon: '🐾', label: 'Pets' },
  { icon: '✏️', label: 'Design' },
  { icon: '🍳', label: 'Culinária' },
  { icon: '➕', label: 'Outros' },
]

const URGENCY = [
  {
    key: 'hoje',       icon: '🔴', title: 'Hoje',       subtitle: 'precisa urgente',
    color: '#FF4757',  border: 'rgba(255,71,87,0.4)',   bg: 'rgba(255,71,87,0.07)',
  },
  {
    key: 'semana',     icon: '🟡', title: 'Essa semana', subtitle: 'nos próximos dias',
    color: '#FFD11A',  border: 'rgba(255,209,26,0.4)',  bg: 'rgba(255,209,26,0.05)',
  },
  {
    key: 'sem_pressa', icon: '🟢', title: 'Sem pressa',  subtitle: 'quando der',
    color: '#22C55E',  border: 'rgba(34,197,94,0.4)',   bg: 'rgba(34,197,94,0.05)',
  },
] as const

type UrgencyKey = typeof URGENCY[number]['key']

/* ─── Section label ───────────────────────────────────────── */
function SectionLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
      {children}{required && <span style={{ color: '#FFD11A', marginLeft: 4 }}>*</span>}
    </p>
  )
}

/* ─── Page ────────────────────────────────────────────────── */
export default function CriarPedidoPage() {
  const router      = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Form state ── */
  const [title,     setTitle]     = useState('')
  const [desc,      setDesc]      = useState('')
  const [category,  setCategory]  = useState<string | null>(null)
  const [urgency,   setUrgency]   = useState<UrgencyKey | null>(null)
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [city,      setCity]      = useState('')
  const [focused,   setFocused]   = useState<string | null>(null)

  /* ── Media state ── */
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  /* ── Async state ── */
  const [publishing,   setPublishing]   = useState(false)
  const [error,        setError]        = useState('')
  const [coords,       setCoords]       = useState<{ lat: number; lng: number } | null>(null)

  const isValid = title.trim().length >= 3 && !!category && !!urgency

  /* ── Init: auth + pre-fill city + GPS ── */
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('city')
        .eq('id', session.user.id)
        .single()
      if (profile?.city) setCity(profile.city as string)
    }
    init()

    // Silent GPS
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* denied — ignore */ },
        { timeout: 8000 },
      )
    }
  }, [router])

  /* ── File select ── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* ── Submit ── */
  async function handlePublish() {
    if (!isValid || publishing) return
    setPublishing(true)
    setError('')

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Upload photo
    let photoUrl: string | null = null
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage
        .from('post-photos')
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false })
      if (!upErr && up) {
        const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(up.path)
        photoUrl = publicUrl
      }
      // If bucket doesn't exist yet, we silently skip photo
    }

    // Insert post via server route (triggers notifyProfessionals)
    const authHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...(session.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    }
    const res = await fetch('/api/posts', {
      method:  'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title:       title.trim(),
        description: desc.trim() || null,
        category,
        urgency,
        budget_min:  budgetMin ? parseInt(budgetMin, 10) : null,
        budget_max:  budgetMax ? parseInt(budgetMax, 10) : null,
        city:        city.trim() || null,
        photo_url:   photoUrl,
        lat:         coords?.lat ?? null,
        lng:         coords?.lng ?? null,
      }),
    })
    const json = await res.json()

    if (!res.ok || !json.ok) {
      setError(json.error ?? 'Erro ao publicar pedido')
      setPublishing(false)
      return
    }

    router.push('/feed')
  }

  /* ── Input box style helper ── */
  function inputStyle(field: string): React.CSSProperties {
    const active = focused === field
    return {
      display: 'flex', alignItems: 'center',
      background: '#1A1A1A',
      border: `1.5px solid ${active ? '#FFD11A' : '#2E2E2E'}`,
      borderRadius: 14,
      padding: '0 16px',
      gap: 10,
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: active ? '0 0 0 3px rgba(255,209,26,0.07)' : 'none',
    }
  }

  /* ─────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0F0F0F',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
    }}>

      {/* ══ STICKY HEADER ══ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #1A1A1A',
      }}>
        <div style={{
          maxWidth: 420, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px',
        }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#666', padding: '4px 0' }}
          >
            ← Cancelar
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #FFD11A, #FF9500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src="/pato-icon.svg" alt="Bikco" width={14} height={14} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 900 }}>
              bikco<span style={{ color: '#FFD11A' }}>.com</span>
            </span>
          </div>

          <button
            onClick={handlePublish}
            disabled={!isValid || publishing}
            style={{
              height: 34, borderRadius: 99, border: 'none',
              background: isValid ? 'linear-gradient(135deg, #FFD11A, #FF9500)' : '#1A1A1A',
              color: isValid ? '#0F0F0F' : '#444',
              fontSize: 13, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed',
              padding: '0 16px', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {publishing ? (
              <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : 'Publicar'}
          </button>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* ── Title section ── */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#FFD11A', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Novo Pedido
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            O que você<br />
            <span style={{ color: '#FFD11A', fontStyle: 'italic' }}>precisa?</span>
          </h1>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#FF6B6B', lineHeight: 1.5 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ══ 1. TÍTULO ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel required>Título do pedido</SectionLabel>
          <div style={{ ...inputStyle('title'), height: 56 }}>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 100))}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
              placeholder="Ex: Pintor para sala e quartos"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: title.length >= 90 ? '#FF9500' : '#444' }}>{title.length}/100</span>
          </div>
        </div>

        {/* ══ 2. DESCRIÇÃO ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Descrição</SectionLabel>
          <div style={{
            background: '#1A1A1A',
            border: `1.5px solid ${focused === 'desc' ? '#FFD11A' : '#2E2E2E'}`,
            borderRadius: 14, padding: '14px 16px',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: focused === 'desc' ? '0 0 0 3px rgba(255,209,26,0.07)' : 'none',
          }}>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value.slice(0, 500))}
              onFocus={() => setFocused('desc')}
              onBlur={() => setFocused(null)}
              placeholder="Descreva com detalhes o que você precisa: local, medidas, urgência, materiais..."
              rows={4}
              style={{
                width: '100%', background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 14, lineHeight: 1.6, resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: desc.length >= 450 ? '#FF9500' : '#444' }}>{desc.length}/500</span>
          </div>
        </div>

        {/* ══ 3. MÍDIA ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Foto do problema</SectionLabel>

          {photoPreview ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: '#1A1A1A' }}>
              <img src={photoPreview} alt="Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={removePhoto}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '24px 16px',
                background: '#1A1A1A',
                border: '1.5px dashed #2E2E2E', borderRadius: 14,
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFD11A44'; e.currentTarget.style.background = '#1E1E1E' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.background = '#1A1A1A' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#888', margin: '0 0 3px' }}>Adicionar foto do problema</p>
                <p style={{ fontSize: 12, color: '#555', margin: 0 }}>JPG, PNG ou MP4 · até 20 MB</p>
              </div>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* ══ 4. CATEGORIA ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel required>Categoria</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const active = category === cat.label
              return (
                <button
                  key={cat.label}
                  onClick={() => setCategory(cat.label)}
                  style={{
                    height: 38, borderRadius: 99,
                    border: `1.5px solid ${active ? '#FFD11A' : '#2A2A2A'}`,
                    background: active ? '#FFD11A' : '#1A1A1A',
                    color: active ? '#0F0F0F' : '#888',
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', padding: '0 13px',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                    boxShadow: active ? '0 2px 10px rgba(255,209,26,0.2)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{cat.icon}</span>
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ 5. URGÊNCIA ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel required>Urgência</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {URGENCY.map(opt => {
              const active = urgency === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setUrgency(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                    border: `1.5px solid ${active ? opt.border : '#2A2A2A'}`,
                    background: active ? opt.bg : '#1A1A1A',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>

                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: active ? opt.color : '#ddd', margin: 0 }}>
                      {opt.title}
                    </p>
                    <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>{opt.subtitle}</p>
                  </div>

                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? opt.color : '#333'}`,
                    background: active ? opt.color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {active && <span style={{ color: '#0F0F0F', fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ 6. ORÇAMENTO ══ */}
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Orçamento (R$)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Min */}
            <div style={{ ...inputStyle('budgetMin'), height: 54 }}>
              <span style={{ fontSize: 13, color: '#555', flexShrink: 0 }}>R$</span>
              <input
                type="number"
                min="0"
                value={budgetMin}
                onChange={e => setBudgetMin(e.target.value)}
                onFocus={() => setFocused('budgetMin')}
                onBlur={() => setFocused(null)}
                placeholder="Mínimo"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, minWidth: 0 }}
              />
            </div>
            {/* Max */}
            <div style={{ ...inputStyle('budgetMax'), height: 54 }}>
              <span style={{ fontSize: 13, color: '#555', flexShrink: 0 }}>R$</span>
              <input
                type="number"
                min="0"
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                onFocus={() => setFocused('budgetMax')}
                onBlur={() => setFocused(null)}
                placeholder="Máximo"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, minWidth: 0 }}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>
            💡 Orçamentos com faixa de preço recebem mais propostas
          </p>
        </div>

        {/* ══ 7. CIDADE ══ */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Cidade</SectionLabel>
          <div style={{ ...inputStyle('city'), height: 56 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused === 'city' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              onFocus={() => setFocused('city')}
              onBlur={() => setFocused(null)}
              placeholder="Ex: Taubaté, SP"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
            />
            {coords && (
              <span title="GPS capturado" style={{ fontSize: 14 }}>📍</span>
            )}
          </div>
          {coords && (
            <p style={{ fontSize: 11, color: '#22C55E', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              ✓ Localização GPS capturada
            </p>
          )}
        </div>

        {/* ══ PUBLISH BUTTON ══ */}
        <button
          onClick={handlePublish}
          disabled={!isValid || publishing}
          style={{
            width: '100%', height: 58, borderRadius: 16, border: 'none',
            background: isValid
              ? 'linear-gradient(135deg, #FFD11A 0%, #FF9500 100%)'
              : '#1A1A1A',
            color: isValid ? '#0F0F0F' : '#444',
            fontSize: 16, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed',
            boxShadow: isValid ? '0 6px 24px rgba(255,209,26,0.3)' : 'none',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
          onMouseEnter={e => { if (isValid) e.currentTarget.style.opacity = '0.92' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {publishing ? (
            <>
              <div style={{ width: 20, height: 20, border: '3px solid rgba(0,0,0,0.15)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Publicando...
            </>
          ) : (
            <>Publicar pedido 🦆</>
          )}
        </button>

        {/* Helper text */}
        {!isValid && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: 10 }}>
            Preencha título, categoria e urgência para publicar
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: #444; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
