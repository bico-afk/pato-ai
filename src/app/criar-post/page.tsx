'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  'Elétrica', 'Encanamento', 'Limpeza', 'Reformas', 'Pintura',
  'Montagem', 'Mudança', 'Jardim', 'Informática', 'Aulas',
  'Beleza', 'Pets', 'Design', 'Culinária', 'Outros',
]

const URGENCY = [
  { value: 'hoje',        label: '🔴 Hoje — urgente',  color: '#FF4D6A', bg: '#2a0511' },
  { value: 'essa_semana', label: '🟡 Essa semana',      color: '#FF7A1A', bg: '#1f1100' },
  { value: 'sem_pressa',  label: '🟢 Sem pressa',       color: '#22C55E', bg: '#0b1f12' },
] as const

type UrgencyVal = typeof URGENCY[number]['value']

const MAX_PHOTOS = 5

/* ═══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
function IcArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
}
function IcCamera() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function IcX() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function IcGps() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
}
function IcCheck() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IcPlus() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}

/* ═══════════════════════════════════════════════════════════
   SHARED INPUT STYLE
══════════════════════════════════════════════════════════════ */
const BASE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: '#171717', border: '1.5px solid #272727',
  borderRadius: 14, color: '#fff', fontSize: 15,
  fontFamily: 'Inter, sans-serif', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const LBL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase',
  marginBottom: 8,
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0, ...style }}>{children}</div>
}

/* ── Filtra input de orçamento: apenas dígitos e um único separador ── */
function filterMoney(v: string): string {
  // remove tudo que não é dígito ou vírgula ou ponto
  let out = v.replace(/[^\d.,]/g, '')
  // troca vírgula por ponto
  out = out.replace(',', '.')
  // garante no máximo um ponto
  const parts = out.split('.')
  if (parts.length > 2) out = parts[0] + '.' + parts.slice(1).join('')
  return out
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function CriarPostPage() {
  const router   = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [userId,    setUserId]    = useState<string | null>(null)
  const [title,     setTitle]     = useState('')
  const [desc,      setDesc]      = useState('')
  const [category,  setCategory]  = useState('')
  const [urgency,   setUrgency]   = useState<UrgencyVal | ''>('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [city,      setCity]      = useState('')

  // ── múltiplas fotos ──
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [previews,   setPreviews]   = useState<string[]>([])

  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [gpsLoading, setGpsLoad]    = useState(false)
  const [published,  setPublished]  = useState(false)

  /* ── Auth + prefill city ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('city').eq('id', data.user.id).single()
      if (p?.city) setCity(p.city)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const canPublish = title.trim().length >= 3 && category !== '' && urgency !== '' && !saving

  /* ── Selecionar fotos (múltiplas) ── */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photoFiles.length
    const toAdd = files.slice(0, remaining)

    setPhotoFiles(prev => [...prev, ...toAdd])
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])

    // limpa o input para permitir selecionar os mesmos arquivos de novo
    e.target.value = ''
  }

  /* ── Remover foto por índice ── */
  function removePhoto(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  /* ── GPS ── */
  function useGPS() {
    if (!navigator.geolocation) return
    setGpsLoad(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=pt`
          )
          const d = await res.json() as { address?: { city?: string; town?: string; village?: string } }
          const c = d.address?.city || d.address?.town || d.address?.village || ''
          if (c) setCity(c)
        } catch { /* ignore */ }
        setGpsLoad(false)
      },
      () => setGpsLoad(false)
    )
  }

  /* ── Upload de todas as fotos ── */
  async function uploadPhotos(uid: string): Promise<string[]> {
    if (!photoFiles.length) return []
    setUploading(true)

    const buckets = ['posts-media', 'post-photos', 'avatars', 'public']
    const urls: string[] = []

    for (const file of photoFiles) {
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      let uploaded = false

      for (const bucket of buckets) {
        const { error: upErr } = await supabase.storage
          .from(bucket).upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
          urls.push(urlData.publicUrl)
          uploaded = true
          break
        }
      }

      if (!uploaded) {
        console.warn('Upload falhou para', file.name)
      }
    }

    setUploading(false)
    return urls
  }

  /* ── Publicar ── */
  async function publish() {
    if (!canPublish || !userId) return
    setSaving(true)
    setError(null)

    try {
      const photoUrls = await uploadPhotos(userId)

      // photo_url = primeira foto (retrocompatível)
      // photo_urls_json = todas (JSON array) se a coluna existir
      const photoUrl = photoUrls[0] ?? null

      const payload = {
        user_id:    userId,
        title:      title.trim(),
        description:desc.trim() || null,
        category,
        urgency,
        budget_min: budgetMin ? parseFloat(budgetMin.replace(',', '.')) : null,
        budget_max: budgetMax ? parseFloat(budgetMax.replace(',', '.')) : null,
        city:       city.trim() || null,
        photo_url:  photoUrl,
        status:     'aberto',
      }

      // Tenta com 'tipo' (schema antigo), depois sem
      const { error: e1 } = await supabase.from('posts').insert({ ...payload, tipo: 'procura' })
      if (e1) {
        const { error: e2 } = await supabase.from('posts').insert(payload)
        if (e2) throw new Error(e2.message)
      }

      setPublished(true)
      setTimeout(() => router.push('/feed'), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
      setSaving(false)
    }
  }

  /* ─── Success screen ─── */
  if (published) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'bounce 0.6s ease' }}>🦆</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: '#fff' }}>Bico publicado!</h2>
        <p style={{ margin: 0, fontSize: 15, color: '#555' }}>Indo para o feed…</p>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:scale(1)} 40%{transform:scale(1.3)} 60%{transform:scale(0.95)} }`}</style>
    </div>
  )

  /* ─── Main render ─── */
  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 420, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <button
            onClick={() => router.push('/feed')}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontFamily: 'inherit', padding: 0 }}
          >
            <IcArrow /> cancelar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Image src="/pato-icon.svg" alt="pato" width={20} height={20} />
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              pato<span style={{ color: '#FFD11A' }}>.ai</span>
            </span>
          </div>
          <button
            onClick={publish}
            disabled={!canPublish}
            style={{
              height: 34, padding: '0 16px', borderRadius: 10, border: 'none',
              backgroundColor: canPublish ? '#FFD11A' : '#1a1800',
              color: canPublish ? '#0F0F0F' : '#3a3a00',
              fontSize: 13, fontWeight: 800, cursor: canPublish ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            {saving ? '…' : 'Publicar'}
          </button>
        </div>
      </header>

      {/* ══ CONTEÚDO ══ */}
      <div style={{ padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Título da tela */}
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            NOVO BICO
          </p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.15 }}>
            O que você{' '}
            <span style={{ color: '#FFD11A', fontStyle: 'italic' }}>precisa?</span>
          </h1>
        </div>

        {/* ── 1. TÍTULO ── */}
        <Section>
          <label style={LBL}>Título *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 100))}
            placeholder="ex: Tomadas queimando na cozinha"
            autoFocus
            style={{ ...BASE, height: 56, padding: '0 16px' }}
            onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.08)' }}
            onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
          />
          <p style={{ margin: '5px 0 0', fontSize: 11, color: title.length > 80 ? '#FFD11A' : '#444', textAlign: 'right' }}>
            {title.length}/100
          </p>
        </Section>

        {/* ── 2. DESCRIÇÃO ── */}
        <Section>
          <label style={LBL}>Descrição</label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value.slice(0, 500))}
            placeholder="Descreva o que precisa com o máximo de detalhes..."
            rows={4}
            style={{ ...BASE, padding: '14px 16px', resize: 'none', lineHeight: 1.6 }}
            onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.08)' }}
            onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
          />
          <p style={{ margin: '5px 0 0', fontSize: 11, color: desc.length > 450 ? '#FFD11A' : '#444', textAlign: 'right' }}>
            {desc.length}/500
          </p>
        </Section>

        {/* ── 3. FOTOS (múltiplas) ── */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ ...LBL, marginBottom: 0 }}>📸 Fotos</label>
            <span style={{ fontSize: 11, color: '#444' }}>{photoFiles.length}/{MAX_PHOTOS}</span>
          </div>

          {/* Input oculto — aceita múltiplos */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          {/* Grid de thumbs + botão adicionar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

            {/* Thumbs das fotos selecionadas */}
            {previews.map((src, idx) => (
              <div key={idx} style={{ position: 'relative', width: 90, height: 90, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                <img
                  src={src}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Indicador "principal" na primeira foto */}
                {idx === 0 && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(255,209,26,0.9)',
                    color: '#000', fontSize: 9, fontWeight: 800, textAlign: 'center',
                    padding: '2px 0', letterSpacing: '0.05em',
                  }}>
                    PRINCIPAL
                  </div>
                )}
                {/* Botão remover */}
                <button
                  onClick={() => removePhoto(idx)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 22, height: 22, borderRadius: '50%',
                    border: 'none', backgroundColor: 'rgba(0,0,0,0.8)',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IcX />
                </button>
              </div>
            ))}

            {/* Botão adicionar — só aparece se não chegou ao limite */}
            {photoFiles.length < MAX_PHOTOS && (
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: previews.length === 0 ? '100%' : 90,
                  height: previews.length === 0 ? 110 : 90,
                  borderRadius: 14,
                  border: '2px dashed #272727',
                  backgroundColor: '#171717',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  color: '#444', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#272727'}
              >
                {previews.length === 0 ? (
                  <>
                    <IcCamera />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>Adicionar fotos</span>
                    <span style={{ fontSize: 11, color: '#333' }}>até {MAX_PHOTOS} imagens</span>
                  </>
                ) : (
                  <IcPlus />
                )}
              </button>
            )}
          </div>

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#888', fontSize: 12 }}>
              <div style={{ width: 14, height: 14, border: '2px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Enviando fotos…
            </div>
          )}

          {photoFiles.length > 1 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#444' }}>
              💡 A primeira foto é a capa do bico no feed. Arraste para reordenar.
            </p>
          )}
        </Section>

        {/* ── 4. CATEGORIA ── */}
        <Section>
          <label style={LBL}>Categoria *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const sel = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(sel ? '' : cat)}
                  style={{
                    padding: '8px 14px', borderRadius: 100,
                    border: 'none',
                    backgroundColor: sel ? '#FFD11A' : '#1e1e1e',
                    color: sel ? '#0F0F0F' : '#888',
                    fontSize: 13, fontWeight: sel ? 800 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    boxShadow: sel ? '0 0 12px rgba(255,209,26,0.25)' : 'none',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── 5. URGÊNCIA ── */}
        <Section>
          <label style={LBL}>Urgência *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {URGENCY.map(opt => {
              const sel = urgency === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUrgency(opt.value)}
                  style={{
                    height: 52, borderRadius: 14,
                    border: `1.5px solid ${sel ? opt.color + '80' : '#242424'}`,
                    backgroundColor: sel ? opt.bg : '#141414',
                    color: sel ? opt.color : '#666',
                    fontSize: 15, fontWeight: sel ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left',
                    padding: '0 18px', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                  {sel && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IcCheck />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── 6. ORÇAMENTO (somente números) ── */}
        <Section>
          <label style={LBL}>💰 Orçamento estimado (R$)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...LBL, marginBottom: 6, color: '#444' }}>Mínimo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMin}
                  onChange={e => setBudgetMin(filterMoney(e.target.value))}
                  placeholder="0"
                  style={{ ...BASE, height: 52, padding: '0 14px 0 36px' }}
                  onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.08)' }}
                  onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
            <div style={{ color: '#333', fontWeight: 700, flexShrink: 0, marginTop: 20 }}>—</div>
            <div style={{ flex: 1 }}>
              <label style={{ ...LBL, marginBottom: 6, color: '#444' }}>Máximo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMax}
                  onChange={e => setBudgetMax(filterMoney(e.target.value))}
                  placeholder="0"
                  style={{ ...BASE, height: 52, padding: '0 14px 0 36px' }}
                  onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.08)' }}
                  onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#333' }}>Opcional — deixe em branco para "a combinar"</p>
        </Section>

        {/* ── 7. CIDADE ── */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ ...LBL, marginBottom: 0 }}>📍 Cidade</label>
            <button
              onClick={useGPS}
              disabled={gpsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #272727', borderRadius: 8, color: gpsLoading ? '#444' : '#FFD11A', fontSize: 11, fontWeight: 600, cursor: gpsLoading ? 'not-allowed' : 'pointer', padding: '5px 10px', fontFamily: 'inherit' }}
            >
              <IcGps />{gpsLoading ? 'detectando…' : 'usar GPS'}
            </button>
          </div>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="ex: São Paulo"
            style={{ ...BASE, height: 56, padding: '0 16px' }}
            onFocus={e => { e.target.style.borderColor = '#FFD11A'; e.target.style.boxShadow = '0 0 0 3px rgba(255,209,26,0.08)' }}
            onBlur={e  => { e.target.style.borderColor = '#272727'; e.target.style.boxShadow = 'none' }}
          />
        </Section>

        {/* Erro */}
        {error && (
          <div style={{ padding: '13px 16px', borderRadius: 12, backgroundColor: '#1f0808', border: '1.5px solid #5c1a1a', color: '#f87171', fontSize: 13, lineHeight: 1.4 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── BOTÃO FINAL ── */}
        <button
          onClick={publish}
          disabled={!canPublish}
          style={{
            height: 56, width: '100%', borderRadius: 14, border: 'none',
            backgroundColor: canPublish ? '#FFD11A' : '#1a1800',
            color: canPublish ? '#0F0F0F' : '#3a3a00',
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px',
            cursor: canPublish ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              publicando…
            </>
          ) : (
            'Publicar bico 🦆'
          )}
        </button>

        {!canPublish && (
          <p style={{ margin: '-18px 0 0', fontSize: 12, color: '#333', textAlign: 'center' }}>
            * Título, categoria e urgência são obrigatórios
          </p>
        )}

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        textarea { resize: none; }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%,100%{transform:scale(1)} 40%{transform:scale(1.3)} 60%{transform:scale(.95)} }
      `}</style>
    </div>
  )
}
