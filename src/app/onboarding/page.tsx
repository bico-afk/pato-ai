'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter }                     from 'next/navigation'
import Image                             from 'next/image'
import { createClient }                  from '@/lib/supabase'

/* ─── Constants ───────────────────────────────────────────── */
const SKILLS = [
  { label: 'Elétrica',    icon: '⚡' },
  { label: 'Encanamento', icon: '🔧' },
  { label: 'Pintura',     icon: '🎨' },
  { label: 'Limpeza',     icon: '🧹' },
  { label: 'Reformas',    icon: '🏗️' },
  { label: 'Aulas',       icon: '📚' },
  { label: 'Informática', icon: '💻' },
  { label: 'Design',      icon: '✏️' },
  { label: 'Culinária',   icon: '🍳' },
  { label: 'Beleza',      icon: '✂️' },
  { label: 'Pets',        icon: '🐾' },
  { label: 'Outros',      icon: '➕' },
]

const STATES = [
  { label: 'Acre',                value: 'AC' },
  { label: 'Alagoas',             value: 'AL' },
  { label: 'Amapá',               value: 'AP' },
  { label: 'Amazonas',            value: 'AM' },
  { label: 'Bahia',               value: 'BA' },
  { label: 'Ceará',               value: 'CE' },
  { label: 'Distrito Federal',    value: 'DF' },
  { label: 'Espírito Santo',      value: 'ES' },
  { label: 'Goiás',               value: 'GO' },
  { label: 'Maranhão',            value: 'MA' },
  { label: 'Mato Grosso',         value: 'MT' },
  { label: 'Mato Grosso do Sul',  value: 'MS' },
  { label: 'Minas Gerais',        value: 'MG' },
  { label: 'Pará',                value: 'PA' },
  { label: 'Paraíba',             value: 'PB' },
  { label: 'Paraná',              value: 'PR' },
  { label: 'Pernambuco',          value: 'PE' },
  { label: 'Piauí',               value: 'PI' },
  { label: 'Rio de Janeiro',      value: 'RJ' },
  { label: 'Rio Grande do Norte', value: 'RN' },
  { label: 'Rio Grande do Sul',   value: 'RS' },
  { label: 'Rondônia',            value: 'RO' },
  { label: 'Roraima',             value: 'RR' },
  { label: 'Santa Catarina',      value: 'SC' },
  { label: 'São Paulo',           value: 'SP' },
  { label: 'Sergipe',             value: 'SE' },
  { label: 'Tocantins',           value: 'TO' },
]

type Step = 1 | 2 | 3

/* ─── Progress bar ────────────────────────────────────────── */
function ProgressDots({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
      {([1, 2, 3] as Step[]).map((s, i) => (
        <Fragment key={s}>
          {i > 0 && (
            <div style={{
              width: 40, height: 2,
              background: step > s - 1 ? '#22C55E' : '#2A2A2A',
              transition: 'background 0.4s ease',
            }} />
          )}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: step > s ? '#22C55E' : step === s ? '#FFD11A' : '#1E1E1E',
            border: `2px solid ${step > s ? '#22C55E' : step === s ? '#FFD11A' : '#2A2A2A'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
            color: step >= s ? '#0F0F0F' : '#444',
            transition: 'all 0.4s ease',
            boxShadow: step === s ? '0 0 12px rgba(255,209,26,0.3)' : 'none',
          }}>
            {step > s ? '✓' : s}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

/* ─── Input wrapper ───────────────────────────────────────── */
function InputBox({
  isFocused,
  hasError = false,
  children,
}: {
  isFocused: boolean
  hasError?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 56, background: '#1A1A1A',
      border: `1.5px solid ${hasError ? '#E24B4A' : isFocused ? '#FFD11A' : '#2E2E2E'}`,
      borderRadius: 14, padding: '0 16px', gap: 12,
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: isFocused && !hasError ? '0 0 0 3px rgba(255,209,26,0.08)' : 'none',
    }}>
      {children}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter()

  const [step,           setStep]           = useState<Step>(1)
  const [name,           setName]           = useState('')
  const [city,           setCity]           = useState('')
  const [state,          setState]          = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [focused,        setFocused]        = useState<string | null>(null)
  const [gpsLoading,     setGpsLoading]     = useState(false)
  const [gpsError,       setGpsError]       = useState('')
  const [saving,         setSaving]         = useState(false)
  const [authLoading,    setAuthLoading]    = useState(true)
  const [animDir,        setAnimDir]        = useState<'forward' | 'back'>('forward')
  const [visible,        setVisible]        = useState(true)

  /* ── Auth guard + pre-fill ── */
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) { router.push('/login'); return }

      // Pre-fill name from auth metadata
      const metaName =
        (session.user.user_metadata?.full_name as string | undefined) ??
        (session.user.user_metadata?.name    as string | undefined)    ??
        ''
      if (metaName) setName(metaName)

      // Check if onboarding already done
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completo, full_name, city')
        .eq('id', session.user.id)
        .single()

      if (profile?.onboarding_completo) { router.push('/feed'); return }
      if (profile?.full_name && !metaName) setName(profile.full_name as string)

      setAuthLoading(false)
    }
    init()
  }, [router])

  /* ── Animated step transition ── */
  function goTo(target: Step, dir: 'forward' | 'back' = 'forward') {
    setAnimDir(dir)
    setVisible(false)
    setTimeout(() => {
      setStep(target)
      setVisible(true)
    }, 180)
  }

  /* ── GPS ── */
  async function handleGPS() {
    if (!navigator.geolocation || gpsLoading) return
    setGpsLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'BikcoAI/1.0 (bikco.com)' } },
          )
          const data = await res.json()
          const addr = data.address ?? {}
          const detectedCity  = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
          const stateIso      = (addr['ISO3166-2-lvl4'] as string | undefined)?.split('-')[1] ?? ''
          if (detectedCity) setCity(detectedCity)
          if (stateIso && STATES.some(s => s.value === stateIso)) setState(stateIso)
        } catch { /* ignore */ }
        setGpsLoading(false)
      },
      () => {
        setGpsLoading(false)
        setGpsError('GPS não permitido. Digite sua cidade manualmente.')
        setTimeout(() => setGpsError(''), 4000)
      },
      { timeout: 12000 },
    )
  }

  /* ── Toggle skill ── */
  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill],
    )
  }

  /* ── Save + redirect ── */
  async function handleFinish(skipSkills = false) {
    if (saving) return
    setSaving(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    try {
      await supabase.from('profiles').upsert({
        id:                  session.user.id,
        full_name:           name.trim(),
        city:                city.trim(),
        state:               state || null,
        skills:              skipSkills ? [] : selectedSkills,
        onboarding_completo: true,
        updated_at:          new Date().toISOString(),
      })
    } catch { /* if column doesn't exist, ignore */ }

    router.push('/feed')
  }

  /* ── Loading / auth check ── */
  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────── */
  /*  RENDER                                                 */
  /* ─────────────────────────────────────────────────────── */
  const slideStyle: React.CSSProperties = {
    opacity:   visible ? 1 : 0,
    transform: visible
      ? 'translateX(0)'
      : animDir === 'forward'
        ? 'translateX(24px)'
        : 'translateX(-24px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0F0F0F',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 20px 48px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative pato */}
      <img src="/pato-icon.svg" alt="" aria-hidden style={{
        position: 'absolute', bottom: -40, right: -60,
        width: 320, height: 320, opacity: 0.04,
        pointerEvents: 'none', userSelect: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          {step > 1 ? (
            <button
              onClick={() => goTo((step - 1) as Step, 'back')}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
              </svg>
              Voltar
            </button>
          ) : <div style={{ width: 60 }} />}

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #FFD11A, #FF9500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Image src="/pato-icon.svg" alt="Bikco" width={18} height={18} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px' }}>
              bikco<span style={{ color: '#FFD11A' }}>.com</span>
            </span>
          </div>

          {/* Pular (only step 3) */}
          {step === 3 ? (
            <button
              onClick={() => handleFinish(true)}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: 4 }}
            >
              Pular
            </button>
          ) : <div style={{ width: 60 }} />}
        </div>

        {/* ── Progress dots ── */}
        <ProgressDots step={step} />

        {/* ── Animated step content ── */}
        <div style={{ flex: 1, ...slideStyle }}>

          {/* ══════════ STEP 1 ══════════ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>👤</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, textAlign: 'center', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
                Como você quer<br />ser chamado?
              </h1>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 36, lineHeight: 1.6 }}>
                Seu nome aparece para outros usuários
              </p>

              <div style={{ width: '100%', marginBottom: 20 }}>
                <InputBox isFocused={focused === 'name'}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused === 'name' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && goTo(2)}
                    placeholder="Ex: Maria Souza"
                    autoFocus
                    autoComplete="name"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 16 }}
                  />
                </InputBox>
              </div>

              <button
                onClick={() => goTo(2)}
                disabled={name.trim().length < 2}
                style={{
                  width: '100%', height: 56, borderRadius: 14, border: 'none',
                  background: name.trim().length >= 2
                    ? 'linear-gradient(135deg, #FFD11A, #FF9500)'
                    : '#1A1A1A',
                  color: name.trim().length >= 2 ? '#0F0F0F' : '#444',
                  fontSize: 15, fontWeight: 800,
                  cursor: name.trim().length >= 2 ? 'pointer' : 'not-allowed',
                  boxShadow: name.trim().length >= 2 ? '0 4px 18px rgba(255,209,26,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ══════════ STEP 2 ══════════ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>📍</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, textAlign: 'center', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
                Onde você está?
              </h1>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 36, lineHeight: 1.6 }}>
                Para mostrar profissionais perto de você
              </p>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {/* City */}
                <InputBox isFocused={focused === 'city'}>
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
                    placeholder="Cidade"
                    autoComplete="address-level2"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
                  />
                </InputBox>

                {/* State dropdown */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    height: 56, background: '#1A1A1A',
                    border: `1.5px solid ${focused === 'state' ? '#FFD11A' : '#2E2E2E'}`,
                    borderRadius: 14,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: focused === 'state' ? '0 0 0 3px rgba(255,209,26,0.08)' : 'none',
                    overflow: 'hidden',
                  }}>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      onFocus={() => setFocused('state')}
                      onBlur={() => setFocused(null)}
                      style={{
                        width: '100%', height: '100%',
                        background: 'transparent', border: 'none', outline: 'none',
                        color: state ? '#fff' : '#444', fontSize: 15,
                        padding: '0 40px 0 16px',
                        cursor: 'pointer',
                        appearance: 'none',
                      }}
                    >
                      <option value="" disabled style={{ background: '#1A1A1A' }}>Estado</option>
                      {STATES.map(s => (
                        <option key={s.value} value={s.value} style={{ background: '#1A1A1A' }}>
                          {s.label} ({s.value})
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Chevron */}
                  <svg style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* GPS button */}
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  style={{
                    height: 50, borderRadius: 14, border: '1px solid #2E2E2E',
                    background: '#1A1A1A', color: '#aaa',
                    fontSize: 14, fontWeight: 600, cursor: gpsLoading ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!gpsLoading) { e.currentTarget.style.borderColor = '#FFD11A44'; e.currentTarget.style.color = '#FFD11A' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.color = '#aaa' }}
                >
                  {gpsLoading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2.5px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                      Detectando localização...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                      </svg>
                      Usar minha localização
                    </>
                  )}
                </button>

                {/* GPS error feedback */}
                {gpsError && (
                  <p style={{ fontSize: 12, color: '#f87171', marginTop: 8, textAlign: 'center' }}>
                    📍 {gpsError}
                  </p>
                )}
              </div>

              <button
                onClick={() => goTo(3)}
                disabled={!city.trim()}
                style={{
                  width: '100%', height: 56, borderRadius: 14, border: 'none',
                  background: city.trim()
                    ? 'linear-gradient(135deg, #FFD11A, #FF9500)'
                    : '#1A1A1A',
                  color: city.trim() ? '#0F0F0F' : '#444',
                  fontSize: 15, fontWeight: 800,
                  cursor: city.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: city.trim() ? '0 4px 18px rgba(255,209,26,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ══════════ STEP 3 ══════════ */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>⚡</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, textAlign: 'center', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
                O que você<br />sabe fazer?
              </h1>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8, lineHeight: 1.6 }}>
                Isso ajuda a Bikco a mostrar oportunidades para você
              </p>
              <p style={{ fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 28 }}>
                Pode escolher mais de um · Opcional
              </p>

              {/* Skills grid */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32, width: '100%' }}>
                {SKILLS.map(skill => {
                  const active = selectedSkills.includes(skill.label)
                  return (
                    <button
                      key={skill.label}
                      onClick={() => toggleSkill(skill.label)}
                      style={{
                        height: 40, borderRadius: 99,
                        border: `1.5px solid ${active ? '#FFD11A' : '#2A2A2A'}`,
                        background: active ? '#FFD11A' : '#1A1A1A',
                        color: active ? '#0F0F0F' : '#888',
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: 'pointer', padding: '0 14px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 2px 10px rgba(255,209,26,0.2)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{skill.icon}</span>
                      {skill.label}
                    </button>
                  )
                })}
              </div>

              {/* CTA buttons */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => handleFinish(false)}
                  disabled={saving}
                  style={{
                    height: 58, borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, #FFD11A, #FF9500)',
                    color: '#0F0F0F', fontSize: 16, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
                    boxShadow: '0 4px 20px rgba(255,209,26,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {saving ? (
                    <div style={{ width: 20, height: 20, border: '3px solid rgba(0,0,0,0.2)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <>Entrar na Bikco 🦆</>
                  )}
                </button>

                <button
                  onClick={() => handleFinish(true)}
                  disabled={saving}
                  style={{
                    height: 46, borderRadius: 14, border: 'none',
                    background: 'none', color: '#555',
                    fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  Pular por agora
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Step counter bottom */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#333', marginTop: 24, fontWeight: 500 }}>
          Etapa {step} de 3
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder  { color: #444; }
        select option       { background: #1A1A1A; color: #fff; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
