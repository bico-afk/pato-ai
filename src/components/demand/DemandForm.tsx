'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { useCreateDemand } from '@/hooks/useCreateDemand'

const MAX_CHARS  = 1000
const MIN_CHARS  = 20
const MAX_FILES  = 3
const BUCKET     = 'demand-media'
const ACCEPT_MEDIA = '.jpg,.jpeg,.png,.webp,.mp4,.mov'

interface MediaPreview {
  file:    File
  url:     string
  type:    'image' | 'video'
  loading: boolean
  error?:  string
}

/* ── Pin icon ───────────────────────────────────────────────── */
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#ff4d7e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

interface DemandFormProps {
  onFormChange?: (data: { description: string; locationCity: string; locationState: string }) => void
}

export default function DemandForm({ onFormChange }: DemandFormProps = {}) {
  const router    = useRouter()
  const supabase  = createClient()
  const { createDemand, loading: submitting, error: submitError } = useCreateDemand()

  const [description,  setDescription]  = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState,setLocationState]= useState('')
  const [locationCountry]               = useState('BR')
  const [geoLoading,   setGeoLoading]   = useState(false)
  const [geoError,     setGeoError]     = useState('')
  const [medias,       setMedias]       = useState<MediaPreview[]>([])
  const [focused,      setFocused]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── Auto-detect location ── */
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ?? ''
          if (key) {
            const res   = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&language=pt-BR&result_type=administrative_area_level_2&key=${key}`)
            const json  = await res.json()
            const comps = json.results?.[0]?.address_components as Array<{ long_name: string; short_name: string; types: string[] }> | undefined
            const city  = comps?.find(c => c.types.includes('administrative_area_level_2'))?.long_name ?? ''
            const state = comps?.find(c => c.types.includes('administrative_area_level_1'))?.short_name ?? ''
            if (city)  setLocationCity(city)
            if (state) setLocationState(state)
          } else {
            // Fallback: Nominatim (gratuito, sem chave)
            const res  = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=pt-BR`,
              { headers: { 'User-Agent': 'Bikco/1.0' } }
            )
            const json = await res.json()
            const addr = json.address as Record<string, string> | undefined
            const city  = addr?.city ?? addr?.town ?? addr?.municipality ?? addr?.village ?? ''
            const state = addr?.['ISO3166-2-lvl4']?.split('-')[1] ?? addr?.state ?? ''
            if (city)  setLocationCity(city)
            if (state) setLocationState(state)
          }
        } catch { /* ignore */ }
        setGeoLoading(false)
      },
      () => { setGeoLoading(false); setGeoError('Localização não permitida — informe manualmente.') },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }, [])

  useEffect(() => { detectLocation() }, [detectLocation])

  // Notify parent of form changes for live preview
  useEffect(() => {
    onFormChange?.({ description, locationCity, locationState })
  }, [description, locationCity, locationState, onFormChange])

  /* ── Media handling ── */
  async function handleFiles(files: FileList) {
    const remaining = MAX_FILES - medias.length
    const toAdd = Array.from(files).slice(0, remaining)
    if (!toAdd.length) return

    const previews: MediaPreview[] = toAdd.map(f => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video') ? 'video' : 'image',
      loading: true,
    }))
    setMedias(prev => [...prev, ...previews])

    // Upload each file
    for (let i = 0; i < toAdd.length; i++) {
      const file = toAdd[i]
      try {
        let uploadFile: File = file

        // Compress images
        if (file.type.startsWith('image/')) {
          uploadFile = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          })
        }

        const ext  = file.name.split('.').pop() ?? 'bin'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { data: stored, error: storageErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, uploadFile, { cacheControl: '3600', upsert: false })

        if (storageErr) {
          console.error('[DemandForm] Storage upload error:', {
            message: storageErr.message,
            statusCode: (storageErr as Record<string, unknown>).statusCode,
            error: (storageErr as Record<string, unknown>).error,
            cause: (storageErr as Record<string, unknown>).cause,
            full: storageErr,
          })
          throw storageErr
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(stored.path)

        setMedias(prev => prev.map((m, idx) =>
          idx === medias.length + i
            ? { ...m, loading: false, url: publicUrl }
            : m
        ))
      } catch (uploadErr) {
        console.error('[DemandForm] Upload catch:', uploadErr)
        setMedias(prev => prev.map((m, idx) =>
          idx === medias.length + i
            ? { ...m, loading: false, error: 'Erro no upload' }
            : m
        ))
      }
    }
  }

  function removeMedia(idx: number) {
    setMedias(prev => prev.filter((_, i) => i !== idx))
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (description.trim().length < MIN_CHARS) return

    const uploadedUrls = medias
      .filter(m => !m.loading && !m.error && m.url.startsWith('http'))
      .map(m => m.url)

    const language = navigator.language?.split('-')[0] ?? 'pt'

    try {
      const { id } = await createDemand({
        description:  description.trim(),
        locationCity: locationCity.trim(),
        locationState:locationState.trim(),
        locationCountry,
        mediaUrls:    uploadedUrls,
        language,
      })
      router.push(`/pedido/${id}`)
    } catch { /* error shown via submitError */ }
  }

  const remaining = MAX_CHARS - description.length
  const canSubmit = description.trim().length >= MIN_CHARS && !submitting && medias.every(m => !m.loading)

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Main textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, MAX_CHARS))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="O que você precisa? Descreva com detalhes — quanto mais claro, mais rápido alguém aparece."
          rows={6}
          autoFocus
          style={{
            width: '100%', resize: 'none',
            background: '#111',
            border: `1px solid ${focused ? '#00d4ff' : '#333'}`,
            borderRadius: 10, padding: '14px 16px',
            color: '#fff', fontSize: 15, lineHeight: 1.6,
            outline: 'none', fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
        />
        {/* Char counter */}
        <span style={{
          position: 'absolute', bottom: 10, right: 14,
          fontSize: 12, color: remaining < 100 ? '#ef4444' : '#444',
        }}>
          {remaining}
        </span>
      </div>

      {/* Location */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#111', border: '1px solid #333', borderRadius: 10,
        padding: '0 14px', height: 50,
      }}>
        {geoLoading
          ? <span style={{ width: 16, height: 16, border: '2px solid #333', borderTopColor: '#ff4d7e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          : <PinIcon />
        }
        <input
          type="text"
          value={locationCity}
          onChange={e => setLocationCity(e.target.value)}
          placeholder="Cidade (detectada automaticamente)"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }}
          onFocus={e => (e.currentTarget.style.color = '#fff')}
        />
        {locationState && (
          <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>{locationState}</span>
        )}
      </div>
      {geoError && <p style={{ fontSize: 12, color: '#ef4444', marginTop: -8 }}>{geoError}</p>}

      {/* Media previews */}
      {medias.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {medias.map((m, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
              {m.type === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={m.url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }} />
                : <video src={m.url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }} muted />
              }
              {m.loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}
              {m.error && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#ef4444', padding: 4, textAlign: 'center' }}>
                  Erro
                </div>
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#ef4444', border: 'none', color: '#fff',
                  fontSize: 12, cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add media button */}
      {medias.length < MAX_FILES && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              background: 'none', border: '1px dashed #333', borderRadius: 10,
              color: '#555', fontSize: 13, padding: '10px 0',
              cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#555' }}
          >
            + Adicionar foto ou vídeo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_MEDIA}
            multiple
            style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </>
      )}

      {/* Error */}
      {submitError && (
        <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{submitError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          width: '100%', height: 54, borderRadius: 10, border: 'none',
          background: canSubmit ? '#fff' : '#1a1a1a',
          color: canSubmit ? '#000' : '#333',
          fontSize: 15, fontWeight: 800,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {submitting
          ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : 'Publicar pedido'
        }
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
