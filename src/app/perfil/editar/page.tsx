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
  'Montador', 'Chaveiro', 'Vidraceiro', 'Motorista particular',
]

export default function EditarPerfilPage() {
  const router   = useRouter()
  const supabase = createClient()
  const avatarRef = useRef<HTMLInputElement>(null)

  const [userId,          setUserId]          = useState('')
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [toast,           setToast]           = useState('')
  const [hasProfProfile,  setHasProfProfile]  = useState(false)

  // users fields
  const [fullName,        setFullName]        = useState('')
  const [bio,             setBio]             = useState('')
  const [phone,           setPhone]           = useState('')
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // professional_profiles fields
  const [headline,   setHeadline]   = useState('')
  const [skills,     setSkills]     = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [city,       setCity]       = useState('')
  const [cityState,  setCityState]  = useState('')
  const [radius,     setRadius]     = useState(50)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth'); return }

    const { data: userRow } = await supabase
      .from('users')
      .select('id, full_name, bio, phone, avatar_url')
      .eq('auth_id', session.user.id)
      .single()
    if (!userRow) { setLoading(false); return }

    const u = userRow as Record<string, unknown>
    const uid = u.id as string
    setUserId(uid)
    setFullName((u.full_name as string | null) ?? '')
    setBio((u.bio as string | null) ?? '')
    setPhone((u.phone as string | null) ?? '')
    setAvatarUrl((u.avatar_url as string | null) ?? null)

    const { data: prof } = await supabase
      .from('professional_profiles')
      .select('headline, skills, location_city, location_state, service_radius_km')
      .eq('user_id', uid)
      .single()

    if (prof) {
      const p = prof as Record<string, unknown>
      setHasProfProfile(true)
      setHeadline((p.headline as string | null) ?? '')
      setSkills((p.skills as string[] | null) ?? [])
      setCity((p.location_city as string | null) ?? '')
      setCityState((p.location_state as string | null) ?? '')
      setRadius((p.service_radius_km as number | null) ?? 50)
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true })
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const { data: stored, error: upErr } = await supabase.storage.from('demand-media').upload(path, compressed, { cacheControl: '3600', upsert: false })
      if (upErr) { showToast('Erro no upload da foto'); setUploadingAvatar(false); return }
      const { data: { publicUrl } } = supabase.storage.from('demand-media').getPublicUrl(stored.path)
      setAvatarUrl(publicUrl)
      showToast('Foto atualizada')
    } catch { showToast('Erro no upload') }
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
    if (fullName.trim().length < 2) { showToast('Nome precisa ter pelo menos 2 caracteres'); return }
    setSaving(true)

    const usersResult = await supabase.from('users').update({
      full_name:  fullName.trim(),
      bio:        bio.trim() || null,
      phone:      phone.trim() || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', userId)

    const profResult = hasProfProfile
      ? await supabase.from('professional_profiles').update({
          headline:          headline.trim() || null,
          skills,
          location_city:     city.trim()      || null,
          location_state:    cityState.trim() || null,
          service_radius_km: radius,
          updated_at:        new Date().toISOString(),
        }).eq('user_id', userId)
      : null

    const usersErr = usersResult.error
    const profErr  = profResult?.error ?? null

    setSaving(false)

    if (usersErr || profErr) {
      showToast('Erro ao salvar: ' + (usersErr?.message ?? profErr?.message ?? ''))
    } else {
      showToast('Perfil salvo!')
      setTimeout(() => router.push('/perfil'), 800)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #111', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '10px 20px', fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800, flex: 1, margin: 0 }}>Editar perfil</h1>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

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
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>Clique para alterar a foto</p>
        </div>

        {/* Section: Dados pessoais */}
        <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#888', margin: 0 }}>Dados pessoais</h2>

          <Field label="Nome completo">
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
          </Field>

          <Field label={`Bio (${bio.length}/200)`}>
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 200))} placeholder="Fale sobre você e seus serviços..." rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', height: 'auto' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
          </Field>

          <Field label="Telefone / WhatsApp">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" type="tel" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
          </Field>
        </div>

        {/* Section: Perfil profissional */}
        {hasProfProfile && (
          <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#888', margin: 0 }}>Perfil profissional</h2>

            <Field label="Headline">
              <input value={headline} onChange={e => setHeadline(e.target.value.slice(0, 120))} placeholder="Ex: Eletricista com 10 anos de experiência" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
            </Field>

            <div>
              <label style={labelStyle}>Habilidades <span style={{ float: 'right', fontWeight: 400, color: '#444' }}>{skills.length}/15</span></label>
              {skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                  {skills.map(s => (
                    <span key={s} style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 99, padding: '4px 10px', fontSize: 12, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {s}<button type="button" onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                  placeholder="Digite e pressione Enter..." style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#111', border: '1px solid #222', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                    {suggestions.map(s => (
                      <button key={s} type="button" onClick={() => addSkill(s)}
                        style={{ width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', color: '#ccc', fontSize: 13, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Cidade" style={{ flex: 1 }}>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
              </Field>
              <Field label="UF">
                <input value={cityState} onChange={e => setCityState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2}
                  style={{ ...inputStyle, width: 56, textAlign: 'center' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#222')} />
              </Field>
            </div>

            <div>
              <label style={labelStyle}>
                Raio de atendimento <span style={{ float: 'right', color: '#00d4ff', fontWeight: 700 }}>{radius} km</span>
              </label>
              <input type="range" min={10} max={200} step={10} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ width: '100%', accentColor: '#00d4ff' }} />
            </div>
          </div>
        )}

        <button type="button" onClick={handleSave} disabled={saving || fullName.trim().length < 2}
          style={{ width: '100%', height: 52, borderRadius: 10, border: 'none', background: (!saving && fullName.trim().length >= 2) ? '#fff' : '#1a1a1a', color: (!saving && fullName.trim().length >= 2) ? '#000' : '#333', fontSize: 15, fontWeight: 800, cursor: (!saving && fullName.trim().length >= 2) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {saving
            ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            : 'Salvar alterações'
          }
        </button>
        <button type="button" onClick={() => router.back()}
          style={{ width: '100%', height: 48, borderRadius: 10, border: '1px solid #1e1e1e', background: 'none', color: '#555', fontSize: 14, cursor: 'pointer' }}>
          Cancelar
        </button>

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: #444; }
      `}</style>
    </div>
  )
}

/* ── Sub-components ── */
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#111', border: '1px solid #222',
  borderRadius: 10, padding: '11px 13px', color: '#fff', fontSize: 14,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 6,
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}
