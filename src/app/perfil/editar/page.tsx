'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const SKILLS = [
  '⚡ Elétrica', '🔧 Encanamento', '🧹 Limpeza', '🏗️ Reformas',
  '🎨 Pintura', '🪛 Montagem', '💻 Informática', '📚 Aulas',
  '✂️ Beleza', '🐾 Pets', '🎨 Design', '🍳 Culinária', '✨ Outros',
]

const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

export default function EditarPerfilPage() {
  const router   = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [userId,      setUserId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [uploadingAv, setUploadingAv] = useState(false)
  const [saved,       setSaved]       = useState(false)

  const [fullName,    setFullName]    = useState('')
  const [bio,         setBio]         = useState('')
  const [city,        setCity]        = useState('')
  const [state,       setState]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [whatsapp,    setWhatsapp]    = useState('')
  const [wppNotifs,   setWppNotifs]   = useState(false)
  const [skills,      setSkills]      = useState<string[]>([])
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)

  /* ── Load ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setFullName(p.full_name ?? '')
        setBio(p.bio ?? '')
        setCity(p.city ?? '')
        setState(p.state ?? '')
        setPhone(p.phone ?? '')
        setWhatsapp(p.whatsapp ?? '')
        setWppNotifs(p.wpp_notificacoes ?? false)
        setSkills(p.skills ?? [])
        setAvatarUrl(p.avatar_url ?? null)
      }
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Upload avatar ── */
  async function uploadAvatar(file: File) {
    if (!userId) return
    setUploadingAv(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${userId}.${ext}`

    for (const bucket of ['avatars', 'post-photos']) {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
      if (!error) {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        setAvatarUrl(pub.publicUrl + '?t=' + Date.now())
        break
      }
    }
    setUploadingAv(false)
  }

  /* ── Save ── */
  async function save() {
    if (!userId || saving) return
    setSaving(true)

    const updates: Record<string, unknown> = {
      full_name: fullName.trim(),
      bio: bio.trim(),
      city: city.trim(),
      state: state.trim(),
      skills,
    }
    if (avatarUrl) updates.avatar_url = avatarUrl

    // Try with optional columns
    const fullUpdates = { ...updates, phone: phone.trim(), whatsapp: whatsapp.trim(), wpp_notificacoes: wppNotifs }
    const { error: e1 } = await supabase.from('profiles').update(fullUpdates).eq('id', userId)
    if (e1) {
      await supabase.from('profiles').update(updates).eq('id', userId)
    }

    setSaved(true)
    setTimeout(() => { setSaved(false); router.push(`/perfil/${userId}`) }, 1200)
    setSaving(false)
  }

  /* ── Toggle skill ── */
  function toggleSkill(s: string) {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 48 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Editar perfil</span>
        <button
          onClick={save}
          disabled={saving || !fullName.trim()}
          style={{ background: 'none', border: 'none', color: saving ? '#888' : '#FFD11A', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 2px' }}
        >
          {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ─── Avatar upload ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{ position: 'relative', width: 90, height: 90, cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ width: 90, height: 90, borderRadius: '50%', border: '3px solid #FFD11A', overflow: 'hidden', backgroundColor: avatarColor(fullName || '?') }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>
                  {initials(fullName || '?')}
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', backgroundColor: '#FFD11A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {uploadingAv ? <div style={{ width: 12, height: 12, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : '📷'}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }} />
          <span style={{ fontSize: 12, color: '#666' }}>Toque para alterar a foto</span>
        </div>

        {/* ─── Nome ─── */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Nome completo *
          </label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Seu nome completo"
            style={{ width: '100%', height: 46, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = '#FFD11A')}
            onBlur={e => (e.target.style.borderColor = '#272727')}
          />
        </div>

        {/* ─── Bio ─── */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Bio
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 200))}
            placeholder="Conte um pouco sobre você e seus serviços..."
            rows={3}
            style={{ width: '100%', backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '12px 14px', fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = '#FFD11A')}
            onBlur={e => (e.target.style.borderColor = '#272727')}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444', textAlign: 'right' }}>{bio.length}/200</p>
        </div>

        {/* ─── Cidade + Estado ─── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Cidade</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="São Paulo"
              style={{ width: '100%', height: 46, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#FFD11A')}
              onBlur={e => (e.target.style.borderColor = '#272727')}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Estado</label>
            <input
              value={state}
              onChange={e => setState(e.target.value.slice(0, 2).toUpperCase())}
              placeholder="SP"
              maxLength={2}
              style={{ width: '100%', height: 46, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase' }}
              onFocus={e => (e.target.style.borderColor = '#FFD11A')}
              onBlur={e => (e.target.style.borderColor = '#272727')}
            />
          </div>
        </div>

        {/* ─── Telefone ─── */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Telefone</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            type="tel"
            style={{ width: '100%', height: 46, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = '#FFD11A')}
            onBlur={e => (e.target.style.borderColor = '#272727')}
          />
        </div>

        {/* ─── WhatsApp ─── */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>WhatsApp</label>
          <input
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-9999"
            type="tel"
            style={{ width: '100%', height: 46, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 12, color: '#fff', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = '#FFD11A')}
            onBlur={e => (e.target.style.borderColor = '#272727')}
          />
        </div>

        {/* ─── Toggle WhatsApp notifs ─── */}
        <div style={{ backgroundColor: '#171717', borderRadius: 12, padding: '14px 16px', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#fff' }}>Notificações no WhatsApp</p>
            <p style={{ margin: 0, fontSize: 12, color: '#555' }}>Receba atualizações sobre seus bicos</p>
          </div>
          <div
            onClick={() => setWppNotifs(v => !v)}
            style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: wppNotifs ? '#FFD11A' : '#272727', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 3, left: wppNotifs ? 23 : 3, width: 20, height: 20, borderRadius: '50%', backgroundColor: wppNotifs ? '#0F0F0F' : '#888', transition: 'left 0.2s' }} />
          </div>
        </div>

        {/* ─── Skills ─── */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Habilidades</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#555' }}>Selecione o que você sabe fazer</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKILLS.map(skill => {
              const selected = skills.includes(skill)
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  style={{
                    borderRadius: 20,
                    padding: '7px 14px',
                    border: `1.5px solid ${selected ? '#FFD11A' : '#272727'}`,
                    backgroundColor: selected ? '#FFD11A' : 'transparent',
                    color: selected ? '#0F0F0F' : '#888',
                    fontSize: 13,
                    fontWeight: selected ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Save button ─── */}
        <button
          onClick={save}
          disabled={saving || !fullName.trim()}
          style={{ width: '100%', height: 54, borderRadius: 14, border: 'none', backgroundColor: !fullName.trim() ? '#1a1a1a' : '#FFD11A', color: !fullName.trim() ? '#555' : '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: !fullName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, transition: 'all 0.2s' }}
        >
          {saved ? '✓ Salvo com sucesso!' : saving ? (
            <><div style={{ width: 18, height: 18, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Salvando...</>
          ) : 'Salvar alterações'}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
