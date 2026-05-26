'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'

const SKILL_SUGGESTIONS = [
  'Eletricista', 'Encanador', 'Pintor', 'Pedreiro', 'Marceneiro',
  'Faxina', 'Jardineiro', 'Cozinheiro', 'Mecânico', 'Fotógrafo',
  'Designer', 'Programador', 'Personal trainer', 'Professor particular',
  'Manicure', 'Cabeleireiro', 'Dog walker', 'Babá', 'Diarista',
  'Montador', 'Chaveiro', 'Vidraceiro', 'Motorista particular', 'Segurança',
]

export default function CriarPerfilPage() {
  const router  = useRouter()
  const supabase = createClient()
  const avatarRef = useRef<HTMLInputElement>(null)

  const [userId,          setUserId]          = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [formError,       setFormError]       = useState('')
  const [headline,        setHeadline]        = useState('')
  const [skills,          setSkills]          = useState<string[]>([])
  const [skillInput,      setSkillInput]      = useState('')
  const [city,            setCity]            = useState('')
  const [cityState,       setCityState]       = useState('')
  const [radius,          setRadius]          = useState(50)
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [geoLoading,      setGeoLoading]      = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()
      if (!userRow) { router.push('/auth'); return }
      const uid = (userRow as Record<string, unknown>).id as string
      setUserId(uid)

      // Pre-fill if profile already exists
      const { data: existing } = await supabase
        .from('professional_profiles')
        .select('headline, skills, location_city, location_state, service_radius_km')
        .eq('user_id', uid)
        .single()
      if (existing) {
        const r = existing as Record<string, unknown>
        setHeadline((r.headline as string | null) ?? '')
        setSkills((r.skills as string[] | null) ?? [])
        setCity((r.location_city as string | null) ?? '')
        setCityState((r.location_state as string | null) ?? '')
        setRadius((r.service_radius_km as number | null) ?? 50)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router])

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ?? ''
          if (key) {
            const res   = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&language=pt-BR&result_type=administrative_area_level_2&key=${key}`)
            const json  = await res.json()
            const comps = json.results?.[0]?.address_components as Array<{ long_name: string; short_name: string; types: string[] }> | undefined
            const c = comps?.find(x => x.types.includes('administrative_area_level_2'))?.long_name ?? ''
            const s = comps?.find(x => x.types.includes('administrative_area_level_1'))?.short_name ?? ''
            if (c) setCity(c)
            if (s) setCityState(s)
          } else {
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=pt-BR`, { headers: { 'User-Agent': 'Bikco/1.0' } })
            const json = await res.json()
            const addr = json.address as Record<string, string> | undefined
            const c = addr?.city ?? addr?.town ?? addr?.municipality ?? ''
            const s = addr?.['ISO3166-2-lvl4']?.split('-')[1] ?? addr?.state ?? ''
            if (c) setCity(c)
            if (s) setCityState(s)
          }
        } catch { /* ignore */ }
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000, maximumAge: 60_000 }
    )
  }, [])

  useEffect(() => { detectLocation() }, [detectLocation])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true })
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const { data: stored, error: upErr } = await supabase.storage.from('demand-media').upload(path, compressed, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('demand-media').getPublicUrl(stored.path)
      setAvatarUrl(publicUrl)
    } catch { /* ignore */ }
    setUploadingAvatar(false)
  }

  const addSkill = (s: string) => {
    const t = s.trim()
    if (!t || skills.includes(t) || skills.length >= 15) return
    setSkills(prev => [...prev, t])
    setSkillInput('')
  }
  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))
  const suggestions = skillInput.length > 0
    ? SKILL_SUGGESTIONS.filter(s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s)).slice(0, 5)
    : []

  async function handleSave() {
    if (!userId) return
    if (!headline.trim()) { setFormError('Headline obrigatória'); return }
    if (skills.length === 0) { setFormError('Adicione pelo menos uma habilidade'); return }
    setSaving(true)
    setFormError('')

    if (avatarUrl) {
      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId)
    }

    const { error: sbErr } = await supabase.from('professional_profiles').upsert({
      user_id:          userId,
      headline:         headline.trim(),
      skills,
      location_city:    city.trim()      || null,
      location_state:   cityState.trim() || null,
      location_country: 'BR',
      service_radius_km: radius,
      is_available:     true,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaving(false)
    if (sbErr) { setFormError('Erro ao salvar: ' + sbErr.message) }
    else { router.push('/perfil') }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #1a1a1a', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const canSubmit = !!headline.trim() && skills.length > 0 && !saving

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', flex: 1, margin: 0 }}>Perfil profissional</h1>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 60px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#0f0f0f', border: '1px solid #1e1e1e', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              }
            </div>
            <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
              style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%', background: '#fff', border: '2px solid #000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploadingAvatar
                ? <span style={{ width: 10, height: 10, border: '1.5px solid #444', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
            </button>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 3px' }}>Foto de perfil</p>
            <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Aparece nos resultados de busca</p>
          </div>
        </div>

        {/* Headline */}
        <div>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Headline <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            value={headline}
            onChange={e => setHeadline(e.target.value.slice(0, 120))}
            placeholder="Ex: Eletricista com 10 anos de experiência"
            style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
          />
          <p style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{headline.length}/120</p>
        </div>

        {/* Skills */}
        <div>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Habilidades <span style={{ color: '#ef4444' }}>*</span>
            <span style={{ float: 'right', fontWeight: 400, color: '#444' }}>{skills.length}/15</span>
          </label>

          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {skills.map(s => (
                <span key={s} style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 99, padding: '5px 12px', fontSize: 13, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1, opacity: 0.7 }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <input
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
              placeholder="Digite e pressione Enter para adicionar..."
              style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#111', border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => addSkill(s)}
                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', color: '#ccc', fontSize: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 10).map(s => (
              <button key={s} type="button" onClick={() => addSkill(s)} style={{ background: 'none', border: '1px solid #222', borderRadius: 99, padding: '5px 12px', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>+ {s}</button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 600, display: 'block', marginBottom: 6 }}>Cidade de atuação</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#111', border: '1px solid #333', borderRadius: 10, padding: '0 14px', height: 48 }}>
              {geoLoading
                ? <span style={{ width: 14, height: 14, border: '2px solid #333', borderTopColor: '#ff4d7e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d7e" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              }
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Cidade (detectada automaticamente)"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>
            <input
              value={cityState}
              onChange={e => setCityState(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              maxLength={2}
              style={{ width: 56, background: '#111', border: '1px solid #333', borderRadius: 10, padding: '0 10px', color: '#fff', fontSize: 14, textAlign: 'center', outline: 'none', height: 48, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Radius */}
        <div>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Raio de atendimento
            <span style={{ float: 'right', color: '#00d4ff', fontWeight: 700 }}>{radius} km</span>
          </label>
          <input type="range" min={10} max={200} step={10} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ width: '100%', accentColor: '#00d4ff' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#444', marginTop: 4 }}>
            <span>10 km</span><span>200 km</span>
          </div>
        </div>

        {formError && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{formError}</p>}

        <button type="button" onClick={handleSave} disabled={!canSubmit}
          style={{ width: '100%', height: 54, borderRadius: 10, border: 'none', background: canSubmit ? '#fff' : '#1a1a1a', color: canSubmit ? '#000' : '#333', fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {saving
            ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            : 'Criar perfil profissional'
          }
        </button>

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #444; }
      `}</style>
    </div>
  )
}
