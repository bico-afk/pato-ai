'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchResult } from '@/hooks/useSearch'

/* ── Star rating ─────────────────────────────────────────── */
function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 1 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

/* ── Professional card ───────────────────────────────────── */
function ProfCard({ result }: { result: SearchResult }) {
  return (
    <div style={{
      background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 10,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #00d4ff22, #00d4ff44)',
          border: '1px solid #00d4ff33',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#00d4ff',
        }}>
          {result.initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {result.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Stars rating={result.rating} />
            <span style={{ fontSize: 11, color: '#475569' }}>
              {result.rating.toFixed(1)} ({result.ratingCount})
            </span>
          </div>
        </div>
        {/* Distance badge */}
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#00d4ff',
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 99, padding: '2px 8px',
        }}>
          {result.distanceKm} km
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55, margin: 0,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
        {result.description}
      </p>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#475569' }}>📍 {result.city}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>✅ {result.jobsDone} bicos</span>
        </div>
        <a
          href={`/profissional/${result.id}`}
          style={{
            height: 32, borderRadius: 6, border: '1px solid #00d4ff33',
            background: 'rgba(0,212,255,0.06)', color: '#00d4ff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            padding: '0 14px', textDecoration: 'none',
            display: 'flex', alignItems: 'center',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = '#00d4ff66' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = '#00d4ff33' }}
        >
          Entrar em contato →
        </a>
      </div>
    </div>
  )
}

/* ── SearchResults ───────────────────────────────────────── */
interface Props {
  results:  SearchResult[]
  loading:  boolean
  error:    string | null
  searched: boolean
  query:    string
  cidade:   string
}

export default function SearchResults({ results, loading, error, searched, query, cidade }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (searched && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [searched])

  if (!searched && !loading) return null

  return (
    <div
      ref={ref}
      style={{
        marginTop: 32,
        opacity: searched || loading ? 1 : 0,
        transform: searched || loading ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 10,
              padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 13, width: '45%', borderRadius: 4, background: '#1a1a1a' }} />
                  <div style={{ height: 10, width: '30%', borderRadius: 4, background: '#141414' }} />
                </div>
              </div>
              <div style={{ height: 12, borderRadius: 4, background: '#161616' }} />
              <div style={{ height: 12, width: '70%', borderRadius: 4, background: '#141414' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>{error}</p>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
            {results.length} profissional{results.length !== 1 ? 'is' : ''} encontrado{results.length !== 1 ? 's' : ''} perto de <span style={{ color: '#94a3b8' }}>{cidade || 'você'}</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {results.map(r => <ProfCard key={r.id} result={r} />)}
          </div>
        </>
      )}

      {/* State B — no results → convert to supply */}
      {!loading && !error && results.length === 0 && searched && (
        <div style={{
          background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, marginBottom: 10 }}>
            Ainda não temos <strong>{query}</strong> em <strong>{cidade || 'sua região'}</strong>.
          </p>
          <p style={{ fontSize: 15, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>
            Seja o primeiro. Cadastre-se e comece a receber chamados desta região.
          </p>
          <button
            onClick={() => router.push(`/criar-perfil?categoria=${encodeURIComponent(query)}&cidade=${encodeURIComponent(cidade)}`)}
            style={{
              background: '#fff', color: '#000',
              fontWeight: 700, fontSize: 14,
              padding: '12px 24px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#00d4ff'
              el.style.color = '#000'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#fff'
              el.style.color = '#000'
            }}
          >
            Quero oferecer este serviço
          </button>
        </div>
      )}
    </div>
  )
}
