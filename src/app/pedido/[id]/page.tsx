'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAnonToken } from '@/lib/anonymous'
import AuthForm from '@/components/auth/AuthForm'

/* ── Types ──────────────────────────────────────────────────── */
interface Demand {
  id:              string
  user_id:         string | null
  anonymous_token: string | null
  description:     string
  location_city:   string | null
  location_state:  string | null
  location_country:string
  status:          string
  candidate_count: number
  media_urls:      string[]
  created_at:      string
}

interface Application {
  id:              string
  professional_id: string
  message:         string
  status:          string
  created_at:      string
  users: { username: string; full_name: string | null } | null
}

/* ── Helpers ─────────────────────────────────────────────────── */
function statusLabel(s: string) {
  if (s === 'open')        return { text: 'Aberto',       color: '#22c55e' }
  if (s === 'in_progress') return { text: 'Em andamento', color: '#f59e0b' }
  if (s === 'closed')      return { text: 'Encerrado',    color: '#888'    }
  return { text: s, color: '#888' }
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)    return 'agora'
  if (m < 60)   return `${m} min atrás`
  if (m < 1440) return `${Math.floor(m / 60)}h atrás`
  return `${Math.floor(m / 1440)}d atrás`
}

export default function PedidoPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const supabase  = createClient()

  const [demand,        setDemand]        = useState<Demand | null>(null)
  const [applications,  setApplications]  = useState<Application[]>([])
  const [loading,       setLoading]       = useState(true)
  const [authUserId,    setAuthUserId]     = useState<string | null>(null)  // users.id
  const [isOwner,       setIsOwner]       = useState(false)
  const [showApply,     setShowApply]     = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [applyMsg,      setApplyMsg]      = useState('')
  const [applying,      setApplying]      = useState(false)
  const [applyError,    setApplyError]    = useState('')
  const [applied,       setApplied]       = useState(false)

  useEffect(() => {
    async function load() {
      // Get auth state
      const { data: { session } } = await supabase.auth.getSession()
      let dbUserId: string | null = null
      if (session?.user) {
        const { data: userRow } = await supabase
          .from('users').select('id').eq('auth_id', session.user.id).single()
        dbUserId = userRow?.id ?? null
        setAuthUserId(dbUserId)
      }

      // Fetch demand
      const { data: d } = await supabase
        .from('demands')
        .select('*')
        .eq('id', id)
        .single()

      if (!d) { router.push('/'); return }
      setDemand(d as Demand)

      // Determine ownership
      const anonTok = getAnonToken()
      const owned =
        (dbUserId && dbUserId === d.user_id) ||
        (d.anonymous_token && d.anonymous_token === anonTok)
      setIsOwner(!!owned)

      // Fetch applications if owner
      if (owned) {
        const { data: apps } = await supabase
          .from('applications')
          .select('id, professional_id, message, status, created_at, users!inner(username, full_name)')
          .eq('demand_id', id)
          .order('created_at', { ascending: false })
        setApplications((apps ?? []) as unknown as Application[])
      }

      // Check if already applied
      if (dbUserId) {
        const { data: mine } = await supabase
          .from('applications')
          .select('id')
          .eq('demand_id', id)
          .eq('professional_id', dbUserId)
          .single()
        if (mine) setApplied(true)
      }

      setLoading(false)
    }
    load()
  }, [id, supabase, router])

  async function handleApply() {
    if (!authUserId) { setShowAuthModal(true); return }
    if (applyMsg.trim().length < 10) { setApplyError('Mínimo 10 caracteres'); return }
    setApplying(true); setApplyError('')
    try {
      const { error } = await supabase.from('applications').insert({
        demand_id:       id,
        professional_id: authUserId,
        message:         applyMsg.trim(),
        status:          'pending',
      })
      if (error) {
        console.error('[apply] Supabase error:', error.code, error.message, error.details, error.hint)
        throw error
      }
      setApplied(true); setShowApply(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao candidatar'
      console.error('[apply] catch:', msg)
      setApplyError(msg)
    } finally {
      setApplying(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #222', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!demand) return null

  const { text: statusText, color: statusColor } = statusLabel(demand.status)

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          BIKCO
        </Link>
        <Link href="/feed" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Feed</Link>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: statusColor,
            background: `${statusColor}18`, border: `1px solid ${statusColor}44`,
            borderRadius: 99, padding: '3px 10px',
          }}>{statusText}</span>
          <span style={{ fontSize: 12, color: '#444' }}>{timeAgo(demand.created_at)}</span>
        </div>

        {/* Description */}
        <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: '24px 28px', marginBottom: 16 }}>
          <p style={{ fontSize: 16, color: '#fff', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
            {demand.description}
          </p>
        </div>

        {/* Location */}
        {demand.location_city && (
          <p style={{ fontSize: 14, color: '#888', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#ff4d7e' }}>📍</span>
            {demand.location_city}{demand.location_state ? `, ${demand.location_state}` : ''} · {demand.location_country}
          </p>
        )}

        {/* Media */}
        {demand.media_urls.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            {demand.media_urls.map((url, i) => {
              const isVideo = /\.(mp4|mov)$/i.test(url)
              return isVideo
                ? <video key={i} src={url} controls style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #1e1e1e', maxHeight: 300 }} />
                // eslint-disable-next-line @next/next/no-img-element
                : <img key={i} src={url} alt="" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #1e1e1e', maxHeight: 400, objectFit: 'cover' }} />
            })}
          </div>
        )}

        {/* Candidate count */}
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28 }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{demand.candidate_count}</span>{' '}
          {demand.candidate_count !== 1 ? 'profissionais se candidataram' : 'profissional se candidatou'}
        </p>

        {/* Apply button (non-owner) */}
        {!isOwner && demand.status === 'open' && (
          <div style={{ marginBottom: 32 }}>
            {applied ? (
              <div style={{ background: '#0f2', border: '1px solid #1e3', borderRadius: 10, padding: '14px 20px', color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
                ✓ Candidatura enviada
              </div>
            ) : showApply ? (
              <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px' }}>
                <p style={{ fontSize: 14, color: '#888', marginBottom: 10 }}>
                  Apresente-se — por que você é a pessoa certa para esse pedido?
                </p>
                <textarea
                  value={applyMsg}
                  onChange={e => setApplyMsg(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder="Fale sobre sua experiência e disponibilidade..."
                  style={{
                    width: '100%', resize: 'none', background: '#111',
                    border: '1px solid #333', borderRadius: 8,
                    color: '#fff', fontSize: 14, padding: '12px 14px',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                  }}
                />
                {applyError && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{applyError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={handleApply}
                    disabled={applying || applyMsg.trim().length < 10}
                    style={{
                      flex: 1, height: 46, borderRadius: 8, border: 'none',
                      background: applyMsg.trim().length >= 10 && !applying ? '#fff' : '#1a1a1a',
                      color: applyMsg.trim().length >= 10 && !applying ? '#000' : '#444',
                      fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {applying ? '...' : 'Enviar candidatura'}
                  </button>
                  <button
                    onClick={() => setShowApply(false)}
                    style={{ height: 46, padding: '0 16px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#555', fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => authUserId ? setShowApply(true) : setShowAuthModal(true)}
                style={{
                  width: '100%', height: 52, borderRadius: 10, border: 'none',
                  background: '#fff', color: '#000',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                }}
              >
                Me candidatar →
              </button>
            )}
          </div>
        )}

        {/* Applications (owner only) */}
        {isOwner && applications.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Candidaturas ({applications.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {applications.map(app => (
                <div key={app.id} style={{
                  background: '#0f0f0f', border: '1px solid #1e1e1e',
                  borderRadius: 12, padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#00d4ff' }}>
                      {app.users?.full_name ?? app.users?.username ?? 'Profissional'}
                    </span>
                    <span style={{ fontSize: 12, color: '#444' }}>{timeAgo(app.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.6, margin: 0 }}>
                    {app.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOwner && applications.length === 0 && demand.status === 'open' && (
          <div style={{ textAlign: 'center', padding: '32px', background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12 }}>
            <p style={{ fontSize: 15, color: '#555', margin: 0 }}>
              Aguardando candidaturas…<br />
              <span style={{ fontSize: 13, color: '#333' }}>Você será notificado quando alguém se candidatar.</span>
            </p>
          </div>
        )}
      </main>

      {/* Auth modal */}
      {showAuthModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowAuthModal(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 999,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 400,
            background: '#0f0f0f', border: '1px solid #1e1e1e',
            borderRadius: 16, padding: '36px 28px',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Crie sua conta em segundos
            </h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
              Para responder, crie sua conta em segundos
            </p>
            <AuthForm onSuccess={() => setShowAuthModal(false)} redirectTo={`/pedido/${id}`} />
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
