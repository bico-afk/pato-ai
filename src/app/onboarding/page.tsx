'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─────────────────────────────────────────────────────────
   LOCATION DATA  —  Brasil primeiro, depois o mundo
   ───────────────────────────────────────────────────────── */
const BR_STATES = [
  { code: 'AC', label: 'Acre' }, { code: 'AL', label: 'Alagoas' },
  { code: 'AP', label: 'Amapá' }, { code: 'AM', label: 'Amazonas' },
  { code: 'BA', label: 'Bahia' }, { code: 'CE', label: 'Ceará' },
  { code: 'DF', label: 'Distrito Federal' }, { code: 'ES', label: 'Espírito Santo' },
  { code: 'GO', label: 'Goiás' }, { code: 'MA', label: 'Maranhão' },
  { code: 'MT', label: 'Mato Grosso' }, { code: 'MS', label: 'Mato Grosso do Sul' },
  { code: 'MG', label: 'Minas Gerais' }, { code: 'PA', label: 'Pará' },
  { code: 'PB', label: 'Paraíba' }, { code: 'PR', label: 'Paraná' },
  { code: 'PE', label: 'Pernambuco' }, { code: 'PI', label: 'Piauí' },
  { code: 'RJ', label: 'Rio de Janeiro' }, { code: 'RN', label: 'Rio Grande do Norte' },
  { code: 'RS', label: 'Rio Grande do Sul' }, { code: 'RO', label: 'Rondônia' },
  { code: 'RR', label: 'Roraima' }, { code: 'SC', label: 'Santa Catarina' },
  { code: 'SP', label: 'São Paulo' }, { code: 'SE', label: 'Sergipe' },
  { code: 'TO', label: 'Tocantins' },
]

const WORLD = [
  { code: 'PT', label: 'Portugal' }, { code: 'AO', label: 'Angola' },
  { code: 'MZ', label: 'Moçambique' }, { code: 'AR', label: 'Argentina' },
  { code: 'UY', label: 'Uruguai' }, { code: 'PY', label: 'Paraguai' },
  { code: 'BO', label: 'Bolívia' }, { code: 'CO', label: 'Colômbia' },
  { code: 'VE', label: 'Venezuela' }, { code: 'CL', label: 'Chile' },
  { code: 'MX', label: 'México' }, { code: 'US', label: 'Estados Unidos' },
  { code: 'CA', label: 'Canadá' }, { code: 'ES', label: 'Espanha' },
  { code: 'FR', label: 'França' }, { code: 'DE', label: 'Alemanha' },
  { code: 'IT', label: 'Itália' }, { code: 'GB', label: 'Reino Unido' },
  { code: 'CH', label: 'Suíça' }, { code: 'AU', label: 'Austrália' },
  { code: 'NZ', label: 'Nova Zelândia' }, { code: 'JP', label: 'Japão' },
  { code: 'SG', label: 'Singapura' }, { code: 'ZA', label: 'África do Sul' },
  { code: 'OTHER', label: 'Outro lugar' },
]

/* ─────────────────────────────────────────────────────────
   HABILIDADES / SKILLS CHIPS
   ───────────────────────────────────────────────────────── */
const SKILLS = [
  '⚡ Elétrica', '🔧 Encanamento', '🧹 Limpeza', '🏗️ Reformas',
  '🎨 Pintura', '🪛 Montagem', '💻 Informática', '📚 Aulas',
  '✂️ Beleza', '🐾 Pets', '🎨 Design', '🍳 Culinária', '✨ Outros',
]

/* ─────────────────────────────────────────────────────────
   ICONS
   ───────────────────────────────────────────────────────── */
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3 3 6-6" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  )
}
function IconGPS() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────
   BARRA DE PROGRESSO COM BOLINHAS
   ───────────────────────────────────────────────────────── */
function ProgressDots({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
      {[1, 2, 3].map((n, i) => {
        const done   = n < step
        const active = n === step
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Linha conectora */}
            {i > 0 && (
              <div style={{
                width: 52, height: 2,
                backgroundColor: done || active ? '#FFD11A' : '#272727',
                transition: 'background-color 0.35s',
              }} />
            )}
            {/* Bolinha */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              backgroundColor: done || active ? '#FFD11A' : '#272727',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.35s',
              boxShadow: active ? '0 0 16px rgba(255,209,26,0.5)' : 'none',
            }}>
              {done
                ? <IconCheck />
                : <span style={{ fontSize: 11, fontWeight: 800, color: active ? '#0F0F0F' : '#555' }}>{n}</span>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,     setStep]     = useState(1)
  const [name,     setName]     = useState('')
  const [city,     setCity]     = useState('')
  const [state,    setState_]   = useState('')
  const [skills,   setSkills]   = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [locating, setLocating] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)

  /* ── Auth + guard ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const uid = data.user.id
      setUserId(uid)

      const meta = data.user.user_metadata
      if (meta?.full_name) setName(meta.full_name as string)
      else if (meta?.name)  setName(meta.name as string)

      const { data: prof } = await supabase
        .from('profiles')
        .select('city, onboarding_completo')
        .eq('id', uid)
        .single()

      if (prof?.city || (prof as Record<string, unknown> | null)?.onboarding_completo) {
        router.push('/feed')
        return
      }
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── GPS ── */
  function useLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=pt`
          )
          const data = await res.json() as { address?: { city?: string; town?: string; village?: string; state?: string; country_code?: string } }
          const addr = data.address || {}
          setCity(addr.city || addr.town || addr.village || '')
          if (addr.country_code === 'br' && addr.state) {
            const match = BR_STATES.find(s => s.label.toLowerCase() === (addr.state ?? '').toLowerCase())
            if (match) setState_(match.code)
          }
        } catch { /* ignore */ }
        setLocating(false)
      },
      () => setLocating(false)
    )
  }

  /* ── Skills toggle ── */
  function toggleSkill(s: string) {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  /* ── Can advance? ── */
  const canContinue =
    step === 1 ? name.trim().length >= 2 :
    step === 2 ? city.trim().length >= 2 && state !== '' :
    true // etapa 3 é sempre avançável (pode pular)

  /* ── Salvar ── */
  async function save(skipSkills = false) {
    if (!userId) return
    setSaving(true)
    setError(null)

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), city: city.trim(), state })
      .eq('id', userId)

    if (dbErr) { setSaving(false); setError('Erro ao salvar. Tente novamente.'); return }

    // Tenta salvar habilidades (ignora erro se coluna não existir)
    if (!skipSkills && skills.length > 0) {
      await supabase.from('profiles')
        .update({ skills } as Record<string, unknown>)
        .eq('id', userId)
    }

    // Tenta marcar onboarding_completo (ignora erro se coluna não existir)
    await supabase.from('profiles')
      .update({ onboarding_completo: true } as Record<string, unknown>)
      .eq('id', userId)

    router.push('/feed')
  }

  function handleNext() {
    if (!canContinue) return
    if (step < 3) { setStep(s => s + 1); setError(null) }
    else save()
  }

  /* ─── Estilos base ─── */
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    height: 56, backgroundColor: '#171717',
    border: '1.5px solid #272727', borderRadius: 14,
    color: '#fff', fontSize: 15, padding: '0 16px',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  /* ─── Spinner ─── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ─────────────── RENDER ─────────────── */
  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', padding: '0 0 48px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/pato-icon.svg" alt="pato" width={30} height={30} />
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px' }}>
              pato<span style={{ color: '#FFD11A' }}>.ai</span>
            </span>
          </div>
        </div>

        {/* Bolinhas de progresso */}
        <ProgressDots step={step} />

        {/* Conteúdo */}
        <div style={{ padding: '0 24px', flex: 1 }}>

          {/* ══ ETAPA 1 — Nome ══ */}
          {step === 1 && (
            <>
              <h1 style={{ margin: '0 0 10px', lineHeight: 1.15 }}>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>Como você quer</span>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#FFD11A', letterSpacing: '-0.8px', fontStyle: 'italic' }}>ser chamado?</span>
              </h1>
              <p style={{ margin: '0 0 28px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
                Seu nome aparece no feed para outros usuários.
              </p>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                placeholder="ex: João Silva"
                autoFocus
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.1)' }}
                onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
              />
            </>
          )}

          {/* ══ ETAPA 2 — Localização ══ */}
          {step === 2 && (
            <>
              <h1 style={{ margin: '0 0 10px', lineHeight: 1.15 }}>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>Onde você</span>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#FFD11A', letterSpacing: '-0.8px', fontStyle: 'italic' }}>está?</span>
              </h1>
              <p style={{ margin: '0 0 22px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
                Para mostrar serviços perto de você.
              </p>

              {/* GPS */}
              <button
                type="button"
                onClick={useLocation}
                disabled={locating}
                style={{
                  width: '100%', height: 48, borderRadius: 14,
                  border: '1.5px solid #272727', backgroundColor: '#171717',
                  color: locating ? '#444' : '#aaa', fontSize: 14, fontWeight: 600,
                  cursor: locating ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 16, fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!locating) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#fff' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#272727'; e.currentTarget.style.color = '#aaa' }}
              >
                <IconGPS />
                {locating ? 'Obtendo localização…' : 'Usar minha localização atual'}
              </button>

              {/* Divisor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: '#1e1e1e' }} />
                <span style={{ fontSize: 10, color: '#333', fontWeight: 700, letterSpacing: '0.08em' }}>OU PREENCHA</span>
                <div style={{ flex: 1, height: 1, backgroundColor: '#1e1e1e' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Cidade */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="ex: São Paulo"
                    autoFocus
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.1)' }}
                    onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Estado / País */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Estado / País</label>
                  <select
                    value={state}
                    onChange={e => setState_(e.target.value)}
                    style={{
                      ...inputStyle,
                      color: state ? '#fff' : '#444',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='7' viewBox='0 0 12 7' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      paddingRight: 44,
                    }}
                    onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.1)' }}
                    onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
                  >
                    <option value="" disabled style={{ backgroundColor: '#1a1a1a', color: '#555' }}>Selecione</option>
                    <optgroup label="── Brasil ─────────────" style={{ backgroundColor: '#1a1a1a' }}>
                      {BR_STATES.map(s => (
                        <option key={s.code} value={s.code} style={{ backgroundColor: '#1a1a1a' }}>
                          {s.label} ({s.code})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="── Mundo ──────────────" style={{ backgroundColor: '#1a1a1a' }}>
                      {WORLD.map(s => (
                        <option key={s.code} value={s.code} style={{ backgroundColor: '#1a1a1a' }}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ══ ETAPA 3 — Habilidades ══ */}
          {step === 3 && (
            <>
              <h1 style={{ margin: '0 0 10px', lineHeight: 1.15 }}>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>O que você</span>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 900, color: '#FFD11A', letterSpacing: '-0.8px', fontStyle: 'italic' }}>sabe fazer?</span>
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
                Isso ajuda o Pato AI a mostrar bicos relevantes para você.
              </p>

              {/* Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SKILLS.map(skill => {
                  const sel = skills.includes(skill)
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 100,
                        border: `1.5px solid ${sel ? '#FFD11A' : '#2a2a2a'}`,
                        backgroundColor: sel ? '#1A1A00' : '#141414',
                        color: sel ? '#FFD11A' : '#888',
                        fontSize: 13, fontWeight: sel ? 700 : 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>

              {skills.length > 0 && (
                <p style={{ margin: '16px 0 0', fontSize: 12, color: '#555' }}>
                  {skills.length} selecionada{skills.length > 1 ? 's' : ''} ✓
                </p>
              )}
            </>
          )}

          {/* Erro */}
          {error && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, backgroundColor: '#1f0808', border: '1.5px solid #5c1a1a', color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Botões ── */}
        <div style={{ padding: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* CTA principal */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue || saving}
            style={{
              height: 56, borderRadius: 14, border: 'none',
              backgroundColor: canContinue && !saving ? '#FFD11A' : '#1a1a00',
              color: canContinue && !saving ? '#0F0F0F' : '#3a3a00',
              fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px',
              cursor: canContinue && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {saving ? 'Salvando…' : step === 3 ? 'Entrar no Pato AI 🦆' : 'Continuar →'}
          </button>

          {/* Pular (apenas etapa 3) */}
          {step === 3 && !saving && (
            <button
              type="button"
              onClick={() => save(true)}
              style={{
                height: 44, borderRadius: 12, border: 'none',
                backgroundColor: 'transparent',
                color: '#444', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#888'}
              onMouseLeave={e => e.currentTarget.style.color = '#444'}
            >
              Pular por agora
            </button>
          )}

          {/* Voltar (etapas 2 e 3) */}
          {step > 1 && !saving && (
            <button
              type="button"
              onClick={() => { setStep(s => s - 1); setError(null) }}
              style={{
                height: 44, borderRadius: 12, border: 'none',
                backgroundColor: 'transparent',
                color: '#333', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit', transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#666'}
              onMouseLeave={e => e.currentTarget.style.color = '#333'}
            >
              <IconArrowLeft /> Voltar
            </button>
          )}

        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        select option { background-color: #1a1a1a; color: #fff; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
