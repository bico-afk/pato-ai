'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAnonToken } from '@/lib/anonymous'
import AuthForm from '@/components/auth/AuthForm'
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES, RealtimeChannel } from '@supabase/supabase-js'

/* ── Types ──────────────────────────────────────────────────── */
interface Demand {
  id:               string
  user_id:          string | null
  anonymous_token:  string | null
  description:      string
  location_city:    string | null
  location_state:   string | null
  location_country: string
  status:           string
  candidate_count:  number
  media_urls:       string[]
  created_at:       string
}

interface Application {
  id:              string
  professional_id: string
  message:         string
  status:          string
  created_at:      string
  users: { username: string; full_name: string | null; avatar_url: string | null } | null
  professional_profiles: { headline: string | null; avg_rating: number | null; total_jobs_completed: number | null } | null
}

/* ── Helpers ──────────────────────────────────────────────── */
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

const initials = (n: string) =>
  (n ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

/* ═══════════════════════════════════════════════════════════ */
export default function PedidoPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current

  const [demand,        setDemand]        = useState<Demand | null>(null)
  const [applications,  setApplications]  = useState<Application[]>([])
  const [loading,       setLoading]       = useState(true)
  const [authUserId,    setAuthUserId]     = useState<string | null>(null)
  const [isOwner,       setIsOwner]       = useState(false)
  const [showApply,     setShowApply]     = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [applyMsg,      setApplyMsg]      = useState('')
  const [applying,      setApplying]      = useState(false)
  const [applyError,    setApplyError]    = useState('')
  const [applied,       setApplied]       = useState(false)
  const [accepting,     setAccepting]     = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    async function load() {
      // Auth
      const { data: { session } } = await supabase.auth.getSession()
      let dbUserId: string | null = null
      if (session?.user) {
        const { data: userRow } = await supabase
          .from('users').select('id').eq('auth_id', session.user.id).single()
        dbUserId = (userRow as Record<string, unknown> | null)?.id as string | null ?? null
        setAuthUserId(dbUserId)
      }

      // Fetch demand
      const { data: d } = await supabase
        .from('demands').select('*').eq('id', id).single()
      if (!d) { router.push('/'); return }
      setDemand(d as unknown as Demand)

      // Ownership
      const anonTok = getAnonToken()
      const demand  = d as unknown as Demand
      const owned   =
        (dbUserId && dbUserId === demand.user_id) ||
        (demand.anonymous_token && demand.anonymous_token === anonTok)
      setIsOwner(!!owned)

      // Fetch enriched applications if owner
      if (owned) {
        const { data: apps } = await supabase
          .from('applications')
          .select(`
            id, professional_id, message, status, created_at,
            users ( username, full_name, avatar_url ),
            professional_profiles ( headline, avg_rating, total_jobs_completed )
          `)
          .eq('demand_id', id)
          .order('created_at', { ascending: true })
        setApplications((apps ?? []) as unknown as Application[])
      }

      // Already applied?
      if (dbUserId) {
        const { data: mine } = await supabase
          .from('applications')
          .select('id').eq('demand_id', id).eq('professional_id', dbUserId).single()
        if (mine) setApplied(true)
      }

      setLoading(false)

      // Realtime — candidate_count on demand
      channelRef.current = supabase
        .channel(`demand-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'demands', filter: `id=eq.${id}` },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const updated = payload.new as Record<string, unknown>
            setDemand(prev => prev
              ? { ...prev, candidate_count: updated.candidate_count as number, status: updated.status as string }
              : prev
            )
          }
        )
        // Also listen for new applications if owner
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'applications', filter: `demand_id=eq.${id}` },
          async () => {
            if (!owned) return
            const { data: apps } = await supabase
              .from('applications')
              .select(`
                id, professional_id, message, status, created_at,
                users!inner ( username, full_name, avatar_url ),
                professional_profiles ( headline, avg_rating, total_jobs_completed )
              `)
              .eq('demand_id', id)
              .order('created_at', { ascending: true })
            setApplications((apps ?? []) as unknown as Application[])
          }
        )
        .subscribe((_s: `${REALTIME_SUBSCRIBE_STATES}`) => { /* noop */ })
    }

    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  /* ── Apply ── */
  async function handleApply() {
    if (!authUserId) { setShowAuthModal(true); return }
    if (applyMsg.trim().length < 10) { setApplyError('Mínimo 10 caracteres'); return }
    setApplying(true); setApplyError('')
    try {
      const { data: inserted, error } = await supabase.from('applications').insert({
        demand_id:       id,
        professional_id: authUserId,
        message:         applyMsg.trim(),
        status:          'pending',
      }).select()
      console.log('[apply] insert result:', { data: inserted, error, professional_id: authUserId })
      if (error) {
        console.error('[apply] error:', error.code, error.message, error.details, error.hint)
        throw error
      }
      setApplied(true); setShowApply(false)
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Erro ao candidatar')
    } finally {
      setApplying(false)
    }
  }

  /* ── Accept application ── */
  async function handleAccept(app: Application) {
    if (!authUserId) return
    setAccepting(app.id)
    try {
      // 1. Update application
      const { error: appErr } = await supabase
        .from('applications').update({ status: 'accepted' }).eq('id', app.id)
      if (appErr) throw appErr

      // 2. Create chat
      const { data: chat, error: chatErr } = await supabase
        .from('chats').insert({
          demand_id:       id,
          application_id:  app.id,
          client_id:       authUserId,
          professional_id: app.professional_id,
          status:          'active',
        }).select('id').single()
      if (chatErr || !chat) throw chatErr ?? new Error('Chat não criado')

      // 3. Navigate
      router.push(`/chat/${(chat as { id: string }).id}`)
    } catch (e) {
      console.error('[accept]', e)
      setAccepting(null)
    }
  }

  /* ── Decline application ── */
  async function handleDecline(appId: string) {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'rejected' } : a))
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #222', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!demand) return null

  const { text: statusText, color: statusColor } = statusLabel(demand.status)
  const pendingApps = applications.filter(a => a.status === 'pending')
  const otherApps   = applications.filter(a => a.status !== 'pending')

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>
        <Link href="/feed" style={{ fontSize: 13, color: '#555', textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}>← Feed</Link>


        {/* Status + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: 99, padding: '3px 10px' }}>
            {statusText}
          </span>
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
            <span>📍</span>
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

        {/* ── APPLY (non-owner) ── */}
        {!isOwner && demand.status === 'open' && (
          <div style={{ marginBottom: 32 }}>
            {applied ? (
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 20px', color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
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
                  style={{ width: '100%', resize: 'none', background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 14, padding: '12px 14px', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                {applyError && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{applyError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={handleApply}
                    disabled={applying || applyMsg.trim().length < 10}
                    style={{ flex: 1, height: 46, borderRadius: 8, border: 'none', background: applyMsg.trim().length >= 10 && !applying ? '#fff' : '#1a1a1a', color: applyMsg.trim().length >= 10 && !applying ? '#000' : '#444', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
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
                style={{ width: '100%', height: 52, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                Me candidatar →
              </button>
            )}
          </div>
        )}

        {/* ── APPLICATIONS (owner) ── */}
        {isOwner && (
          <div style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
              Candidaturas
              {applications.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 13, color: '#00d4ff', fontWeight: 700, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 99, padding: '2px 10px' }}>
                  {applications.length}
                </span>
              )}
            </h2>

            {applications.length === 0 && demand.status === 'open' && (
              <div style={{ textAlign: 'center', padding: '32px', background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12 }}>
                <p style={{ fontSize: 15, color: '#555', margin: 0 }}>
                  Aguardando candidaturas…<br />
                  <span style={{ fontSize: 13, color: '#333' }}>Você será notificado quando alguém se candidatar.</span>
                </p>
              </div>
            )}

            {/* Pending */}
            {pendingApps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {pendingApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    onAccept={() => handleAccept(app)}
                    onDecline={() => handleDecline(app.id)}
                    accepting={accepting === app.id}
                  />
                ))}
              </div>
            )}

            {/* Accepted / rejected */}
            {otherApps.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: '#444', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Processadas
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {otherApps.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onAccept={() => handleAccept(app)}
                      onDecline={() => handleDecline(app.id)}
                      accepting={accepting === app.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth modal */}
      {showAuthModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowAuthModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 999 }}
        >
          <div style={{ width: '100%', maxWidth: 400, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: '36px 28px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Crie sua conta em segundos</h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>Para se candidatar, crie uma conta rápida</p>
            <AuthForm onSuccess={() => setShowAuthModal(false)} redirectTo={`/pedido/${id}`} />
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ── ApplicationCard ──────────────────────────────────────── */
function ApplicationCard({
  app, onAccept, onDecline, accepting
}: {
  app:       Application
  onAccept:  () => void
  onDecline: () => void
  accepting: boolean
}) {
  const isPending  = app.status === 'pending'
  const isAccepted = app.status === 'accepted'
  const isRejected = app.status === 'rejected'
  const pp  = app.professional_profiles
  const usr = app.users

  return (
    <div style={{
      background: '#0f0f0f',
      border: `1px solid ${isAccepted ? 'rgba(34,197,94,0.2)' : isRejected ? '#161616' : '#1e1e1e'}`,
      borderRadius: 14, padding: '18px 20px',
      opacity: isRejected ? 0.5 : 1,
    }}>
      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: '#1a1a1a', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {usr?.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={usr.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 13, fontWeight: 800, color: '#00d4ff' }}>{initials(usr?.full_name ?? usr?.username ?? '')}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {usr?.full_name ?? usr?.username ?? 'Profissional'}
          </p>
          {pp?.headline && (
            <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pp.headline}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {pp?.avg_rating != null && pp.avg_rating > 0 && (
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
              ★ {pp.avg_rating.toFixed(1)}
            </span>
          )}
          {pp?.total_jobs_completed != null && pp.total_jobs_completed > 0 && (
            <span style={{ fontSize: 11, color: '#444' }}>
              {pp.total_jobs_completed} bico{pp.total_jobs_completed !== 1 ? 's' : ''}
            </span>
          )}
          {isAccepted && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Aceito</span>}
          {isRejected && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>Recusado</span>}
        </div>
      </div>

      {/* Message */}
      <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.6, margin: '0 0 14px', padding: '12px 14px', background: '#111', borderRadius: 8 }}>
        {app.message}
      </p>

      {/* Actions */}
      {isPending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onAccept}
            disabled={accepting}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: accepting ? '#1a1a1a' : '#fff', color: accepting ? '#444' : '#000', fontSize: 13, fontWeight: 800, cursor: accepting ? 'not-allowed' : 'pointer' }}
          >
            {accepting ? '...' : 'Aceitar →'}
          </button>
          <button
            onClick={onDecline}
            disabled={accepting}
            style={{ height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}
          >
            Recusar
          </button>
        </div>
      )}

      {isAccepted && (
        <p style={{ fontSize: 12, color: '#22c55e', margin: 0, fontWeight: 600 }}>
          ✓ Chat aberto com este profissional
        </p>
      )}
    </div>
  )
}
