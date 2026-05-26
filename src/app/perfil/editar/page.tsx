'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Constants ─────────────────────────────────────── */
const SKILL_SUGGESTIONS = [
  'Encanador', 'Eletricista', 'Pintor', 'Pedreiro', 'Marceneiro',
  'Faxineira', 'Jardineiro', 'Motorista', 'Cozinheiro', 'Mecânico',
  'Designer', 'Fotógrafo', 'Programador', 'Personal trainer', 'Professor',
  'Manicure', 'Cabeleireiro', 'Maquiador', 'Dog walker', 'Babá',
  'Diarista', 'Entregador', 'Montador', 'Chaveiro', 'Vidraceiro',
]

/* ─── Main Page ──────────────────────────────────────── */
export default function EditarPerfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Form state
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  // Upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const id = session.user.id
    setUid(id)

    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) {
      setFullName(data.full_name ?? '')
      setBio(data.bio ?? '')
      setCity(data.city ?? '')
      setState(data.state ?? '')
      setPhone(data.phone ?? '')
      setSkills(data.skills ?? [])
      setAvatarUrl(data.avatar_url ?? null)
      setCoverUrl(data.cover_url ?? null)
    }
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  /* ─── Avatar upload ──── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${uid}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      setAvatarUrl(publicUrl)
      showToast('✅ Foto de perfil atualizada')
    } catch {
      // Fallback: try post-photos bucket
      try {
        const ext = file.name.split('.').pop()
        const path = `avatars/${uid}/avatar.${ext}`
        const { error } = await supabase.storage.from('post-photos').upload(path, file, { upsert: true })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(path)
        const publicUrl = urlData.publicUrl + '?t=' + Date.now()
        setAvatarUrl(publicUrl)
        showToast('✅ Foto de perfil atualizada')
      } catch {
        showToast('❌ Erro ao fazer upload da foto')
      }
    }
    setUploadingAvatar(false)
  }

  /* ─── Cover upload ──── */
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    setUploadingCover(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `covers/${uid}/cover.${ext}`
      const { error } = await supabase.storage.from('post-photos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      setCoverUrl(publicUrl)
      showToast('✅ Foto de capa atualizada')
    } catch {
      showToast('❌ Erro ao fazer upload da capa')
    }
    setUploadingCover(false)
  }

  /* ─── Skills ──── */
  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (!s || skills.includes(s) || skills.length >= 15) return
    setSkills(prev => [...prev, s])
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill))
  }

  const filteredSuggestions = skillInput.length > 0
    ? SKILL_SUGGESTIONS.filter(s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s))
    : []

  /* ─── Save ──── */
  const handleSave = async () => {
    if (!uid) return
    if (fullName.trim().length < 2) { showToast('❌ Nome precisa ter pelo menos 2 caracteres'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: uid,
      full_name: fullName.trim(),
      bio: bio.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      phone: phone.trim() || null,
      skills,
      avatar_url: avatarUrl,
      cover_url: coverUrl,
    })
    setSaving(false)
    if (error) {
      showToast('❌ Erro ao salvar: ' + error.message)
    } else {
      showToast('✅ Perfil salvo!')
      setTimeout(() => router.push('/perfil'), 1000)
    }
  }

  /* ─── Render ──── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 40 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1A1A', border: '1px solid #333', borderRadius: 12, padding: '10px 20px',
          fontSize: 14, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1E1E1E', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        maxWidth: 480, margin: '0 auto',
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0 }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>Editar Perfil</span>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* Cover photo */}
        <div style={{ position: 'relative', height: 120, marginBottom: 52, marginTop: 0 }}>
          <div style={{
            width: '100%', height: '100%',
            background: coverUrl
              ? `url(${coverUrl}) center/cover`
              : 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 50%, #FFD11A22 100%)',
            borderRadius: '0 0 12px 12px',
          }} />
          <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', border: '1px solid #444',
            borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12,
            cursor: uploadingCover ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {uploadingCover ? '⏳' : '📷'} {uploadingCover ? 'Enviando…' : 'Alterar capa'}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />

          {/* Avatar */}
          <div style={{ position: 'absolute', bottom: -44, left: 16 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #0F0F0F', overflow: 'hidden', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28 }}>🦆</span>
                }
              </div>
              <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: '50%',
                background: uploadingAvatar ? '#555' : '#FFD11A',
                border: '2px solid #0F0F0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: uploadingAvatar ? 'default' : 'pointer', fontSize: 12,
              }}>{uploadingAvatar ? '⏳' : '📷'}</button>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>

          {/* Full name */}
          <div>
            <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>Nome completo *</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Seu nome"
              style={{
                width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15,
                outline: 'none',
              }}
            />
          </div>

          {/* Bio */}
          <div>
            <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>
              Bio
              <span style={{ float: 'right', fontWeight: 400, color: bio.length > 180 ? '#ef4444' : '#555' }}>{bio.length}/200</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 200))}
              placeholder="Fale um pouco sobre você e seus serviços…"
              rows={3}
              style={{
                width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>

          {/* City + State */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>Cidade</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
                style={{
                  width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                  borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>Estado</label>
              <input
                value={state}
                onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
                style={{
                  width: 56, background: '#1A1A1A', border: '1px solid #2A2A2A',
                  borderRadius: 10, padding: '12px 10px', color: '#fff', fontSize: 14,
                  outline: 'none', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>Telefone / WhatsApp</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              type="tel"
              style={{
                width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* Skills */}
          <div>
            <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600 }}>
              Habilidades
              <span style={{ float: 'right', fontWeight: 400, color: '#555' }}>{skills.length}/15</span>
            </label>

            {/* Current skills */}
            {skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {skills.map(skill => (
                  <span key={skill} style={{
                    background: '#FFD11A22', border: '1px solid #FFD11A55',
                    borderRadius: 20, padding: '6px 12px', fontSize: 13, color: '#FFD11A',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {skill}
                    <button onClick={() => removeSkill(skill)} style={{
                      background: 'none', border: 'none', color: '#FFD11A', cursor: 'pointer',
                      padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7,
                    }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ position: 'relative' }}>
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) }
                }}
                placeholder="Digite uma habilidade e pressione Enter…"
                style={{
                  width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                  borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14,
                  outline: 'none',
                }}
              />

              {/* Suggestions dropdown */}
              {filteredSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: '0 0 10px 10px',
                  maxHeight: 180, overflowY: 'auto',
                }}>
                  {filteredSuggestions.slice(0, 6).map(s => (
                    <button key={s} onClick={() => addSkill(s)} style={{
                      width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                      color: '#ddd', fontSize: 14, textAlign: 'left', cursor: 'pointer',
                      borderBottom: '1px solid #2A2A2A',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2A2A2A')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 8).map(s => (
                <button key={s} onClick={() => addSkill(s)} style={{
                  background: '#1A1A1A', border: '1px solid #333', borderRadius: 20,
                  padding: '5px 12px', fontSize: 12, color: '#888', cursor: 'pointer',
                }}>+ {s}</button>
              ))}
            </div>
          </div>

        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || fullName.trim().length < 2}
          style={{
            width: '100%', padding: '16px 0', marginTop: 28,
            background: saving || fullName.trim().length < 2 ? '#333' : '#FFD11A',
            color: saving || fullName.trim().length < 2 ? '#666' : '#000',
            border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
            cursor: saving || fullName.trim().length < 2 ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Salvando…' : '✅ Salvar perfil'}
        </button>

        <button onClick={() => router.back()} style={{
          width: '100%', padding: '14px 0', marginTop: 10,
          background: 'none', border: '1px solid #2A2A2A', borderRadius: 14,
          color: '#888', fontSize: 15, cursor: 'pointer',
        }}>
          Cancelar
        </button>

      </div>
    </div>
  )
}
