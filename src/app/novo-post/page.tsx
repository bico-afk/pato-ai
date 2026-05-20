'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ── Brazilian states ─────────────────────────────────── */
const STATES = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' }, { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' }, { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
]

const CATEGORIES = ['Elétrica', 'Encanamento', 'Limpeza', 'Reformas', 'Pintura', 'Montagem', 'Mudança', 'Jardim', 'Informática', 'Aulas', 'Beleza', 'Pets', 'Outros']
const URGENCY_OPTIONS = [
  { value: 'hoje', label: '🔴 Hoje — urgente', color: '#FF6B35' },
  { value: 'essa_semana', label: '🟡 Essa semana', color: '#FFD11A' },
  { value: 'flexivel', label: '🟢 Sem pressa', color: '#22C55E' },
]
const AVAIL_OPTIONS = ['Manhã (6h–12h)', 'Tarde (12h–18h)', 'Noite (18h–22h)', 'Qualquer horário']

/* ── Icons ────────────────────────────────────────────── */
function IconArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
}
function IconCamera() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
}
function IconGps() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>
}
function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
function IconCheck() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
}
function IconPin() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
}

/* ── Styles ───────────────────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', backgroundColor: '#171717',
  border: '1.5px solid #272727', borderRadius: 14,
  color: '#FFFFFF', fontSize: 15, outline: 'none',
  transition: 'border-color 0.15s', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#888', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
}

/* ── PostPreview (review step) ────────────────────────── */
function PostPreview({ data }: { data: FormData }) {
  return (
    <div style={{ backgroundColor: '#171717', borderRadius: 16, overflow: 'hidden', margin: '0 0 8px' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#FFD11A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#0F0F0F' }}>V</div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Você</p>
            {data.city && (
              <p style={{ margin: 0, fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconPin />{data.city}{data.state ? `, ${data.state}` : ''}
              </p>
            )}
          </div>
          <span style={{ marginLeft: 'auto', color: '#444', fontSize: 12 }}>agora</span>
        </div>
        {data.category && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#FFD11A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{data.category}</p>}
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>{data.title || 'Título do bico'}</h3>
        {data.description && <p style={{ margin: '0 0 8px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>{data.description}</p>}
      </div>
      {data.photoPreview && (
        <div style={{ margin: '0 16px 12px', borderRadius: 12, overflow: 'hidden' }}>
          <img src={data.photoPreview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {!data.combinar && (data.budgetMin || data.budgetMax) && (
            <span style={{ fontSize: 12, color: '#777' }}>R$ {data.budgetMin || '?'}–{data.budgetMax || '?'}</span>
          )}
          {data.combinar && <span style={{ fontSize: 12, color: '#777' }}>💬 A combinar</span>}
          {data.urgency === 'hoje' && <span style={{ backgroundColor: '#FF6B35', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>hoje</span>}
          {data.urgency === 'essa_semana' && <span style={{ backgroundColor: '#2a2a2a', color: '#aaa', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 10px' }}>essa semana</span>}
          {data.disponibilidade && <span style={{ fontSize: 12, color: '#777' }}>🕐 {data.disponibilidade}</span>}
          <span style={{ fontSize: 12, color: data.visibilidade === 'patos_proximos' ? '#3B82F6' : '#555', marginLeft: 'auto' }}>
            {data.visibilidade === 'patos_proximos' ? '🔒 só patos próximos' : '🌐 público'}
          </span>
        </div>
        {data.category && (
          <span style={{ fontSize: 12, color: '#444', backgroundColor: '#1c1c1c', borderRadius: 6, padding: '2px 8px' }}>
            #{data.category.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  )
}

interface FormData {
  title: string; description: string; category: string
  urgency: 'hoje' | 'essa_semana' | 'flexivel'
  budgetMin: string; budgetMax: string; combinar: boolean
  city: string; state: string; disponibilidade: string
  visibilidade: 'publico' | 'patos_proximos'
  photoFile: File | null; photoPreview: string | null
}

/* ── Main ─────────────────────────────────────────────── */
export default function NovoPostPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step,    setStep]    = useState<'form' | 'review'>('form')
  const [tipo,    setTipo]    = useState<'procura' | 'oferta'>('procura')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [userId,  setUserId]  = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    title: '', description: '', category: '',
    urgency: 'flexivel',
    budgetMin: '', budgetMax: '', combinar: false,
    city: '', state: '', disponibilidade: '',
    visibilidade: 'publico',
    photoFile: null, photoPreview: null,
  })

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      supabase.from('profiles').select('city, state').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (p?.city) set('city', p.city)
          if (p?.state) set('state', p.state)
        })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, photoFile: file, photoPreview: preview }))
  }

  function handleGps() {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude, longitude } = pos.coords
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
        const data = await res.json()
        const city = data.address?.city || data.address?.town || data.address?.village || ''
        const stateCode = data.address?.['ISO3166-2-lvl4']?.split('-')[1] || ''
        if (city) set('city', city)
        if (stateCode) set('state', stateCode)
      } catch { /* fallback silently */ }
      setGpsLoading(false)
    }, () => setGpsLoading(false))
  }

  async function handlePublish() {
    if (!userId) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }
    setLoading(true); setError(null)
    try {
      // Upload photo if exists
      let photoUrl: string | null = null
      if (form.photoFile) {
        const ext = form.photoFile.name.split('.').pop()
        const path = `${userId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('post-photos').upload(path, form.photoFile, { upsert: true })
        if (upErr) {
          console.warn('Photo upload failed (continuing without photo):', upErr.message)
        } else {
          const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }

      const payload = {
        user_id: userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        urgency: form.urgency,
        budget_min: !form.combinar && form.budgetMin ? parseFloat(form.budgetMin) : null,
        budget_max: !form.combinar && form.budgetMax ? parseFloat(form.budgetMax) : null,
        city: form.city.trim() || null,
        state: form.state || null,
        photo_url: photoUrl,
        status: 'aberto',
        tipo,
      }

      // Try with optional columns first
      const { error: dbErr } = await supabase.from('posts').insert({
        ...payload,
        disponibilidade: form.disponibilidade || null,
        visibilidade: form.visibilidade,
      })

      if (dbErr) {
        console.warn('Insert with extra columns failed, trying fallback:', dbErr.message)
        // Fallback: insert without optional columns
        const { error: dbErr2 } = await supabase.from('posts').insert(payload)
        if (dbErr2) {
          console.error('Post insert failed:', dbErr2)
          throw new Error(`Erro ao salvar: ${dbErr2.message}`)
        }
      }

      router.push('/feed')
    } catch (e: unknown) {
      console.error('handlePublish error:', e)
      setError(e instanceof Error ? e.message : 'Erro ao publicar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const canReview = form.title.trim().length >= 5

  const chevronStyle: React.CSSProperties = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
    appearance: 'none', paddingRight: 40,
  }

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, backgroundColor: '#0F0F0F', zIndex: 10,
        borderBottom: '1px solid #181818',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
      }}>
        <button
          onClick={() => step === 'review' ? setStep('form') : router.push('/feed')}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
        >
          <IconArrow /> {step === 'review' ? 'editar' : 'cancelar'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>pato<span style={{ color: '#FFD11A' }}>.ai</span></span>
        </div>
        {step === 'form' ? (
          <button
            onClick={() => canReview && setStep('review')}
            disabled={!canReview}
            style={{ height: 34, padding: '0 16px', borderRadius: 10, border: 'none', backgroundColor: canReview ? '#FFD11A' : '#1a1800', color: canReview ? '#0F0F0F' : '#444', fontSize: 13, fontWeight: 700, cursor: canReview ? 'pointer' : 'not-allowed' }}
          >
            Revisar →
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={loading}
            style={{ height: 34, padding: '0 16px', borderRadius: 10, border: 'none', backgroundColor: loading ? '#b89a12' : '#FFD11A', color: '#0F0F0F', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '...' : 'Publicar'}
          </button>
        )}
      </div>

      {/* ── STEP: FORM ─────────────────────────────────── */}
      {step === 'form' && (
        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Tipo toggle */}
          <div style={{ display:'flex', backgroundColor:'#141414', borderRadius:14, padding:4, gap:4 }}>
            {([
              { key:'procura', icon:'🔍', label:'Preciso de alguém', desc:'Estou procurando um serviço' },
              { key:'oferta',  icon:'🔧', label:'Ofereço esse serviço', desc:'Quero mostrar o que faço' },
            ] as const).map(opt => (
              <button key={opt.key} type="button" onClick={() => setTipo(opt.key)}
                style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`1.5px solid ${tipo===opt.key?'#FFD11A44':'transparent'}`, backgroundColor:tipo===opt.key?'#1a1500':'transparent', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{opt.icon}</div>
                <p style={{ margin:'0 0 2px', fontSize:12, fontWeight:700, color:tipo===opt.key?'#FFD11A':'#666' }}>{opt.label}</p>
                <p style={{ margin:0, fontSize:10, color:'#444' }}>{opt.desc}</p>
              </button>
            ))}
          </div>

          <div>
            <p style={{ color: '#FFD11A', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              {tipo === 'oferta' ? 'MEU SERVIÇO' : 'NOVO BICO'}
            </p>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
              {tipo === 'oferta'
                ? <>O que você<br /><span style={{ color: '#FFD11A', fontStyle: 'italic' }}>oferece?</span></>
                : <>O que você<br /><span style={{ color: '#FFD11A', fontStyle: 'italic' }}>precisa?</span></>}
            </h1>
          </div>

          {/* ── MÍDIA ──────────────────────────────────── */}
          <div>
            <label style={labelStyle}>📸 Foto do problema</label>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handlePhoto} style={{ display: 'none' }} />
            {form.photoPreview ? (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                <img src={form.photoPreview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => setForm(p => ({ ...p, photoFile: null, photoPreview: null }))}
                  style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                style={{ width: '100%', height: 100, borderRadius: 14, border: '1.5px dashed #2a2a2a', backgroundColor: '#111', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#444' }}
              >
                <IconCamera />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Adicionar foto ou vídeo</span>
              </button>
            )}
          </div>

          {/* ── TÍTULO ─────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Título *</label>
            <input
              type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="ex: Tomadas queimando na cozinha"
              maxLength={100} autoFocus
              style={{ ...inputBase, height: 56, padding: '0 16px' }}
              onFocus={e => (e.target.style.borderColor = '#FFD11A')}
              onBlur={e => (e.target.style.borderColor = '#272727')}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444', textAlign: 'right' }}>{form.title.length}/100</p>
          </div>

          {/* ── DESCRIÇÃO ──────────────────────────────── */}
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes..."
              rows={4} maxLength={500}
              style={{ ...inputBase, padding: '14px 16px', resize: 'none', lineHeight: 1.5 }}
              onFocus={e => (e.target.style.borderColor = '#FFD11A')}
              onBlur={e => (e.target.style.borderColor = '#272727')}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444', textAlign: 'right' }}>{form.description.length}/500</p>
          </div>

          {/* ── CATEGORIA ──────────────────────────────── */}
          <div>
            <label style={labelStyle}>Categoria</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => set('category', form.category === cat ? '' : cat)}
                  style={{ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${form.category === cat ? '#FFD11A' : '#242424'}`, backgroundColor: form.category === cat ? '#1a1500' : '#141414', color: form.category === cat ? '#FFD11A' : '#666', fontSize: 13, fontWeight: form.category === cat ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ── URGÊNCIA ───────────────────────────────── */}
          <div>
            <label style={labelStyle}>Urgência</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {URGENCY_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => set('urgency', opt.value as FormData['urgency'])}
                  style={{ height: 50, borderRadius: 12, border: `1.5px solid ${form.urgency === opt.value ? opt.color + '66' : '#242424'}`, backgroundColor: form.urgency === opt.value ? opt.color + '15' : '#141414', color: form.urgency === opt.value ? opt.color : '#666', fontSize: 14, fontWeight: form.urgency === opt.value ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', padding: '0 16px' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── LOCALIZAÇÃO ────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>📍 Localização</label>
              <button onClick={handleGps} disabled={gpsLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #272727', borderRadius: 8, color: gpsLoading ? '#444' : '#FFD11A', fontSize: 12, fontWeight: 600, cursor: gpsLoading ? 'not-allowed' : 'pointer', padding: '5px 10px' }}>
                <IconGps />{gpsLoading ? 'buscando...' : 'Usar minha localização'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Cidade"
                style={{ ...inputBase, flex: 1, height: 50, padding: '0 14px' }}
                onFocus={e => (e.target.style.borderColor = '#FFD11A')}
                onBlur={e => (e.target.style.borderColor = '#272727')} />
              <select value={form.state} onChange={e => set('state', e.target.value)}
                style={{ ...inputBase, ...chevronStyle, height: 50, padding: '0 36px 0 14px', width: 110, cursor: 'pointer', color: form.state ? '#fff' : '#555' }}
                onFocus={e => (e.target.style.borderColor = '#FFD11A')}
                onBlur={e => (e.target.style.borderColor = '#272727')}>
                <option value="" style={{ backgroundColor: '#171717' }}>UF</option>
                {STATES.map(s => <option key={s.uf} value={s.uf} style={{ backgroundColor: '#171717' }}>{s.uf}</option>)}
              </select>
            </div>
          </div>

          {/* ── ORÇAMENTO ──────────────────────────────── */}
          <div>
            <label style={labelStyle}>💰 Orçamento estimado</label>
            {/* A combinar toggle */}
            <button type="button" onClick={() => set('combinar', !form.combinar)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: `1.5px solid ${form.combinar ? '#FFD11A44' : '#242424'}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer', marginBottom: 10, backgroundColor: form.combinar ? '#1a1500' : 'transparent' }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${form.combinar ? '#FFD11A' : '#333'}`, backgroundColor: form.combinar ? '#FFD11A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {form.combinar && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: 14, color: form.combinar ? '#FFD11A' : '#666', fontWeight: form.combinar ? 700 : 400 }}>💬 Não sei / a combinar</span>
            </button>
            {!form.combinar && (
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="number" value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)} placeholder="R$ Mínimo"
                  style={{ ...inputBase, flex: 1, height: 50, padding: '0 14px' }}
                  onFocus={e => (e.target.style.borderColor = '#FFD11A')}
                  onBlur={e => (e.target.style.borderColor = '#272727')} />
                <div style={{ display: 'flex', alignItems: 'center', color: '#333', fontWeight: 700, flexShrink: 0 }}>—</div>
                <input type="number" value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)} placeholder="R$ Máximo"
                  style={{ ...inputBase, flex: 1, height: 50, padding: '0 14px' }}
                  onFocus={e => (e.target.style.borderColor = '#FFD11A')}
                  onBlur={e => (e.target.style.borderColor = '#272727')} />
              </div>
            )}
          </div>

          {/* ── DISPONIBILIDADE ────────────────────────── */}
          <div>
            <label style={labelStyle}>🕐 Disponibilidade preferida</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AVAIL_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => set('disponibilidade', form.disponibilidade === opt ? '' : opt)}
                  style={{ padding: '9px 14px', borderRadius: 20, border: `1.5px solid ${form.disponibilidade === opt ? '#FFD11A' : '#242424'}`, backgroundColor: form.disponibilidade === opt ? '#1a1500' : '#141414', color: form.disponibilidade === opt ? '#FFD11A' : '#666', fontSize: 13, fontWeight: form.disponibilidade === opt ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* ── VISIBILIDADE ───────────────────────────── */}
          <div>
            <label style={labelStyle}>🔒 Visibilidade</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { v: 'publico', icon: '🌐', title: 'Público', desc: 'Qualquer pato do Brasil pode ver e responder.' },
                { v: 'patos_proximos', icon: '📍', title: 'Só patos próximos', desc: 'Visível apenas para patos na sua cidade.' },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => set('visibilidade', opt.v)}
                  style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${form.visibilidade === opt.v ? '#FFD11A44' : '#242424'}`, backgroundColor: form.visibilidade === opt.v ? '#1a1500' : '#141414', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: form.visibilidade === opt.v ? '#FFD11A' : '#fff' }}>{opt.title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>{opt.desc}</p>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${form.visibilidade === opt.v ? '#FFD11A' : '#333'}`, backgroundColor: form.visibilidade === opt.v ? '#FFD11A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {form.visibilidade === opt.v && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button onClick={() => canReview && setStep('review')} disabled={!canReview}
            style={{ height: 56, width: '100%', borderRadius: 14, border: 'none', backgroundColor: canReview ? '#FFD11A' : '#1a1800', color: canReview ? '#0F0F0F' : '#444', fontSize: 15, fontWeight: 700, cursor: canReview ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            Revisar antes de publicar →
          </button>
        </div>
      )}

      {/* ── STEP: REVIEW ───────────────────────────────── */}
      {step === 'review' && (
        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: '#1f0a0a', border: '1.5px solid #5c1a1a', color: '#f87171', fontSize: 14, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}
          <div>
            <p style={{ color: '#FFD11A', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>REVISÃO</p>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              Tudo certo?
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#555' }}>Veja como seu bico vai aparecer no feed.</p>
          </div>

          <PostPreview data={form} />

          {/* Checklist */}
          <div style={{ backgroundColor: '#141414', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { ok: form.title.length >= 5, label: 'Título preenchido' },
              { ok: !!form.description, label: 'Descrição adicionada' },
              { ok: !!form.category, label: 'Categoria selecionada' },
              { ok: !!form.city, label: 'Cidade informada' },
              { ok: form.combinar || !!(form.budgetMin || form.budgetMax), label: 'Orçamento definido' },
              { ok: !!form.photoPreview, label: 'Foto adicionada' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: item.ok ? '#22C55E20' : '#1e1e1e', border: `1.5px solid ${item.ok ? '#22C55E' : '#2a2a2a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: item.ok ? '#22C55E' : '#333' }}>
                  {item.ok ? <IconCheck /> : <span style={{ fontSize: 10, color: '#444' }}>–</span>}
                </div>
                <span style={{ fontSize: 13, color: item.ok ? '#aaa' : '#444' }}>{item.label}</span>
                {!item.ok && <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>opcional</span>}
              </div>
            ))}
          </div>

          <button onClick={handlePublish} disabled={loading}
            style={{ height: 56, width: '100%', borderRadius: 14, border: 'none', backgroundColor: loading ? '#b89a12' : '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {loading ? 'publicando...' : 'Publicar bico 🦆'}
          </button>

          <button onClick={() => setStep('form')}
            style={{ height: 44, width: '100%', borderRadius: 14, border: 'none', backgroundColor: 'transparent', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar e editar
          </button>
        </div>
      )}
    </div>
  )
}
