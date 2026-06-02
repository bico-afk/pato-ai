'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { getAnonToken } from '@/lib/anonymous'
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
        {/* Distance badge — only when a distance is known */}
        {result.distanceKm > 0 && (
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#00d4ff',
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 99, padding: '2px 8px',
          }}>
            {result.distanceKm} km
          </span>
        )}
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
  const supabaseRef = useRef(createPublicClient())
  const supabase    = supabaseRef.current

  // Auto-publish state — when a search returns no professionals, the query
  // becomes a published demand. The user is NEVER told there's scarcity.
  const [publishing,    setPublishing]    = useState(false)
  const [publishedId,   setPublishedId]   = useState<string | null>(null)
  const [publishError,  setPublishError]  = useState<string | null>(null)
  const publishedForRef = useRef<string | null>(null) // guards one publish per query

  useEffect(() => {
    if (searched && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [searched])

  // Reset publish state whenever a new query is searched
  useEffect(() => {
    if (publishedForRef.current !== query) {
      setPublishedId(null)
      setPublishError(null)
    }
  }, [query])

  // Auto-publish when search completes with zero results
  useEffect(() => {
    const noResults = searched && !loading && !error && results.length === 0 && !!query.trim()
    if (!noResults) return
    if (publishedForRef.current === query) return // already handled this query

    publishedForRef.current = query
    const parts = cidade.split(',').map(s => s.trim()).filter(Boolean)
    const city  = parts[0] ?? ''
    const state = parts[1] ?? ''

    setPublishing(true)
    setPublishError(null)
    ;(async () => {
      const { data, error: insErr } = await supabase
        .from('demands')
        .insert({
          title:            query.slice(0, 120),
          description:      query,
          location_city:    city,
          location_state:   state,
          location_country: 'BR',
          anonymous_token:  getAnonToken(),
          status:           'open',
          language:         'pt',
          candidate_count:  0,
        })
        .select('id')
        .maybeSingle()

      if (insErr) {
        const e = insErr as { message?: string; name?: string; code?: string }
        const detail = e.message || e.name || e.code || 'erro de rede'
        console.error('[SearchResults] auto-publish error:', detail, insErr)
        setPublishError(`Não foi possível publicar: ${detail}`)
        publishedForRef.current = null // allow retry on next search
      } else {
        // Success — clear any previous error and record the new demand id.
        setPublishError(null)
        setPublishedId((data as { id: string } | null)?.id ?? '')
      }
      setPublishing(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, loading, error, results.length, query, cidade])

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

      {/* No professionals → the query becomes a published demand.
          The user is never told there's scarcity. */}
      {!loading && !error && results.length === 0 && searched && (
        <div style={{
          background: '#0a1f14', border: '1px solid #1a4a2e', borderRadius: 12,
          padding: 24, textAlign: 'center',
        }}>
          {(publishing || (publishedId === null && publishError === null)) ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
              <span style={{ width: 24, height: 24, border: '2px solid #1a4a2e', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
              <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Publicando seu pedido…</p>
            </div>
          ) : publishError && publishedId === null ? (
            <p style={{ fontSize: 14, color: '#ef4444', margin: 0 }}>{publishError}</p>
          ) : (
            <>
              {/* Check icon */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
                Pedido publicado!
              </p>
              <p style={{ fontSize: 15, color: '#888', lineHeight: 1.6, margin: '0 0 24px' }}>
                Os profissionais da sua região já foram avisados.<br />
                Em breve alguém entra em contato com você.
              </p>

              <button
                onClick={() => publishedId && router.push(`/pedido/${publishedId}`)}
                disabled={!publishedId}
                style={{
                  background: publishedId ? '#fff' : '#1a1a1a',
                  color: publishedId ? '#000' : '#444',
                  fontWeight: 800, fontSize: 14,
                  padding: '12px 24px', borderRadius: 8,
                  border: 'none', cursor: publishedId ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s',
                }}
              >
                Acompanhar meu pedido →
              </button>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
