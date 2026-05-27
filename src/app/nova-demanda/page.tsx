'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import DemandForm from '@/components/demand/DemandForm'
import { useAuth } from '@/hooks/useAuth'

/* ── Pin icon ─────────────────────────────────────────────── */
function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="#ff4d7e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/* ── Live preview card ────────────────────────────────────── */
function PreviewCard({
  description, locationCity, locationCountry, username,
}: {
  description:     string
  locationCity:    string
  locationCountry: string
  username:        string
}) {
  const isEmpty = !description.trim()

  return (
    <div>
      <p style={{
        fontSize: 11, color: '#555', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: 12,
      }}>
        Como vai aparecer no feed
      </p>

      <div style={{
        background: '#0f0f0f',
        border: `1px ${isEmpty ? 'dashed' : 'solid'} ${isEmpty ? '#333' : '#1e1e1e'}`,
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.2s, border-style 0.2s',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: isEmpty ? '#333' : '#00d4ff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {username}
          </span>
          <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>agora</span>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 15, lineHeight: 1.55, margin: 0,
          color: isEmpty ? '#444' : '#fff',
          fontStyle: isEmpty ? 'italic' : 'normal',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const,
        }}>
          {isEmpty ? 'Sua descrição vai aparecer aqui…' : description}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PinIcon />
            {locationCity || 'Sua cidade'} · {locationCountry}
          </span>
          <span style={{ fontSize: 12, color: '#555' }}>0 candidatos</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function NovaDemandaPage() {
  const { profile } = useAuth()
  const [preview, setPreview] = useState({ description: '', locationCity: '', locationState: '' })
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  const handleFormChange = useCallback((data: { description: string; locationCity: string; locationState: string }) => {
    setPreview(data)
  }, [])

  const username = profile?.username ? `@${profile.username}` : '@você'

  return (
    <div style={{
      minHeight: '100dvh', background: '#000',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Heading */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 900,
            letterSpacing: '-0.75px', color: '#fff', marginBottom: 6,
          }}>
            O que você precisa?
          </h1>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            Descreva o serviço. Profissionais da sua região vão se candidatar.{' '}
            <Link href="/feed" style={{ color: '#444', textDecoration: 'none' }}>Ver pedidos →</Link>
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 40,
          alignItems: 'start',
        }}>
          {/* Left: Form */}
          <div style={{ minWidth: 0 }}>
            <DemandForm onFormChange={handleFormChange} />

            {/* Mobile preview toggle */}
            <div className="mobile-preview-toggle" style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowMobilePreview(v => !v)}
                style={{
                  background: 'none', border: 'none', color: '#555',
                  fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}
              >
                {showMobilePreview ? 'Ocultar prévia ↑' : 'Ver prévia →'}
              </button>

              {showMobilePreview && (
                <div style={{ marginTop: 16 }}>
                  <PreviewCard
                    description={preview.description}
                    locationCity={preview.locationCity}
                    locationCountry="BR"
                    username={username}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview (desktop only) */}
          <div className="desktop-preview" style={{ minWidth: 0, position: 'sticky', top: 72 }}>
            <PreviewCard
              description={preview.description}
              locationCity={preview.locationCity}
              locationCountry="BR"
              username={username}
            />
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 680px) {
          .desktop-preview { display: none !important; }
          .mobile-preview-toggle { display: block !important; }
        }
        @media (min-width: 681px) {
          .mobile-preview-toggle { display: none !important; }
        }
      `}</style>
    </div>
  )
}
