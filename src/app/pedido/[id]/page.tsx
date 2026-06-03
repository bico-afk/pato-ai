'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createPublicClient } from '@/lib/supabase/public'
import { getAnonToken } from '@/lib/anonymous'
import { useAuth } from '@/hooks/useAuth'
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

type PriceType = 'fixed' | 'hourly' | 'negotiable'

interface Application {
  id:              string
  professional_id: string
  message:         string
  status:          string
  created_at:      string
  price_type:      PriceType | null
  price_amount:    number | null
  users: { username: string; full_name: string | null; avatar_url: string | null; bio: string | null; phone: string | null; phone_country_code: string | null } | null
  professional_profiles: { headline: string | null; skills: string[] | null; avg_rating: number | null; total_jobs_completed: number | null; trust_score: number | null } | null
}

/** Texto amigável do preço de uma candidatura */
function priceLabel(type: PriceType | null, amount: number | null): string | null {
  if (!type) return null
  const v = amount != null
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null
  if (type === 'negotiable') return 'A combinar'
  if (type === 'hourly')     return v ? `${v}/hora` : 'Por hora'
  return v ?? 'Preço fixo'
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

/** Builds a wa.me link from a stored phone, or null if no usable number. */
function waLink(phone: string | null | undefined, cc: string | null | undefined, msg: string): string | null {
  let d = (phone ?? '').replace(/\D/g, '')
  if (!d) return null
  const ccd = (cc ?? '+55').replace(/\D/g, '') || '55'
  if (!d.startsWith(ccd) && d.length <= 11) d = ccd + d
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`
}

/** Rejects if the promise/thenable doesn't settle within `ms` — guards against
 *  the session client's getSession() hanging during a token refresh. */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/* ═══════════════════════════════════════════════════════════ */
export default function PedidoPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const supabaseRef = useRef(createClient())          // session client — for auth-dependent writes
  const supabase    = supabaseRef.current
  const pubRef      = useRef(createPublicClient())    // anon client — for public reads (never hangs)
  const pub         = pubRef.current
  const { profile } = useAuth()                       // reliable logged-in identity (no getSession hang)

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
  const [priceType,     setPriceType]     = useState<PriceType>('negotiable')
  const [priceAmount,   setPriceAmount]   = useState('')
  const [copied,        setCopied]        = useState(false)
  const [applied,       setApplied]       = useState(false)
  const [accepting,     setAccepting]     = useState<string | null>(null)
  const [hasProfile,    setHasProfile]    = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const channelRef   = useRef<RealtimeChannel | null>(null)
  const wantsApplyRef = useRef(false)   // veio do botão "Tenho interesse" do feed
  const triggeredRef  = useRef(false)

  // Detecta a intenção de candidatar vinda do feed (?interesse=1)
  useEffect(() => {
    wantsApplyRef.current = new URLSearchParams(window.location.search).get('interesse') === '1'
  }, [])

  useEffect(() => {
    async function load() {
      // 1) PUBLIC read of the demand — the page opens regardless of auth state.
      const { data: d } = await pub.from('demands').select('*').eq('id', id).maybeSingle()
      if (!d) { router.push('/'); return }
      const raw = d as unknown as Demand
      // Normalize nullable columns so the UI can assume arrays/numbers.
      const demand: Demand = {
        ...raw,
        media_urls:      raw.media_urls ?? [],
        candidate_count: raw.candidate_count ?? 0,
      }
      setDemand(demand)

      // Anonymous ownership needs no auth (token from localStorage).
      const anonTok = getAnonToken()
      const owned = !!(demand.anonymous_token && demand.anonymous_token === anonTok)
      if (owned) setIsOwner(true)
      setLoading(false) // page is ready to render NOW
      // (Logged-in ownership + applications are resolved in a separate effect
      //  driven by useAuth — see below — which is reliable and never hangs.)

      // Realtime — candidate_count on demand (public client, never hangs)
      channelRef.current = pub
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
        .subscribe((_s: `${REALTIME_SUBSCRIBE_STATES}`) => { /* noop */ })
    }

    load()
    return () => { if (channelRef.current) pub.removeChannel(channelRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  /* ── Auth-dependent: ownership + applications, driven by useAuth ──
     useAuth resolves the logged-in user reliably (same source as the navbar),
     so ownership of a logged-in post is detected without a fragile getSession. */
  useEffect(() => {
    if (!demand) return
    const myId = profile?.id ?? null
    if (myId) {
      setAuthUserId(myId)
      // Does this user already have a professional profile? (public read, never hangs)
      ;(async () => {
        try {
          const { data } = await pub.from('professional_profiles').select('id').eq('user_id', myId).maybeSingle()
          setHasProfile(!!data)
        } catch { /* ignore */ }
        finally { setProfileChecked(true) }
      })()
    }

    const ownedByAccount = !!(myId && demand.user_id && myId === demand.user_id)
    const ownedByAnon    = !!(demand.anonymous_token && demand.anonymous_token === getAnonToken())
    const owner = ownedByAccount || ownedByAnon
    if (owner) setIsOwner(true)

    if (owner) {
      // Owner → load candidaturas
      ;(async () => {
        try {
          const { data: apps } = await withTimeout(supabase
            .from('applications')
            .select(`
              id, professional_id, message, status, created_at, price_type, price_amount,
              users ( username, full_name, avatar_url, bio, phone, phone_country_code ),
              professional_profiles ( headline, skills, avg_rating, total_jobs_completed, trust_score )
            `)
            .eq('demand_id', id)
            .order('created_at', { ascending: true }), 8_000) as { data: Application[] | null }
          setApplications((apps ?? []) as unknown as Application[])
        } catch { /* degrade silently */ }
      })()
    } else if (myId) {
      // Non-owner logged in → did I already apply?
      ;(async () => {
        try {
          const { data: mine } = await withTimeout(supabase
            .from('applications')
            .select('id').eq('demand_id', id).eq('professional_id', myId).maybeSingle(), 8_000) as { data: { id: string } | null }
          if (mine) setApplied(true)
        } catch { /* ignore */ }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, demand])

  /* ── Inicia a candidatura (botão "Me candidatar" ou intenção "Tenho interesse") ── */
  function startApply() {
    if (isOwner || demand?.status !== 'open') return
    // Sem conta OU sem perfil de profissional → vai pro chat /prestador e volta pra cá.
    if (!authUserId) { setShowAuthModal(true); return }
    if (!hasProfile) {
      router.push(`/prestador?next=${encodeURIComponent(`/pedido/${id}?interesse=1`)}`)
      return
    }
    setShowApply(true)
  }

  /* ── Auto-abre a candidatura quando o usuário chega pelo "Tenho interesse" ── */
  useEffect(() => {
    if (triggeredRef.current) return
    if (loading || !demand) return
    if (!wantsApplyRef.current) return
    if (isOwner || demand.status !== 'open') return
    if (!authUserId) { triggeredRef.current = true; setShowAuthModal(true); return }
    if (!profileChecked) return            // espera saber se já tem perfil
    triggeredRef.current = true
    startApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, demand, isOwner, authUserId, profileChecked, hasProfile])

  /* ── Apply ── */
  async function handleApply() {
    if (!authUserId) { setShowAuthModal(true); return }
    if (isOwner) { setApplyError('Você não pode se candidatar ao seu próprio pedido.'); return }
    if (applyMsg.trim().length < 10) { setApplyError('Mínimo 10 caracteres'); return }
    const amountNum = priceType === 'negotiable' ? null : parseFloat(priceAmount.replace(',', '.'))
    if (priceType !== 'negotiable' && (!amountNum || amountNum <= 0)) {
      setApplyError('Informe o valor ou escolha "A combinar".'); return
    }
    setApplying(true); setApplyError('')
    try {
      const { data: inserted, error } = await withTimeout(supabase.from('applications').insert({
        demand_id:       id,
        professional_id: authUserId,
        message:         applyMsg.trim(),
        status:          'pending',
        price_type:      priceType,
        price_amount:    amountNum,
      }).select(), 10_000) as { data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }
      if (error) {
        console.error('[apply] error:', error.code, error.message, error.details, error.hint)
        throw new Error(error.message ?? 'Erro ao candidatar')
      }
      void inserted
      setApplied(true); setShowApply(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao candidatar'
      setApplyError(msg === 'timeout' ? 'Demorou demais. Tente de novo.' : msg)
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

  /* ── Compartilhar / Indicar um profissional ── */
  async function sharePedido() {
    const url  = `${window.location.origin}/pedido/${id}`
    const text = demand ? demand.description.slice(0, 80) : 'Pedido na Bikco'
    if (navigator.share) {
      try { await navigator.share({ title: 'Bikco', text, url }) } catch { /* cancelado */ }
    } else {
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
    }
  }

  function referProfessional() {
    const url = `${window.location.origin}/pedido/${id}`
    const msg = `Vi esse bico na Bikco e lembrei de você 👀\n\n"${demand?.description.slice(0, 120) ?? ''}"\n\nSe tiver interesse, é só se candidatar: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  /* ── Encerrar pedido (dono) — some do feed (status != open) ── */
  const [closing, setClosing] = useState(false)
  async function closeDemand() {
    if (closing) return
    setClosing(true)
    try {
      const { error } = await withTimeout(
        supabase.from('demands').update({ status: 'closed' }).eq('id', id), 10_000,
      ) as { error: { message?: string } | null }
      if (error) throw error
      setDemand(prev => prev ? { ...prev, status: 'closed' } : prev)
    } catch (e) {
      console.error('[pedido] close error:', e)
    } finally {
      setClosing(false)
    }
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

        {/* Meta + ações: período, compartilhar, indicar um profissional */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#aaa', background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 99, padding: '7px 14px' }}>
            🕒 Publicado {timeAgo(demand.created_at)}
          </span>
          <button onClick={sharePedido}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: copied ? '#22c55e' : '#ddd', background: '#0f0f0f', border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : '#1e1e1e'}`, borderRadius: 99, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = copied ? 'rgba(34,197,94,0.4)' : '#1e1e1e')}>
            {copied ? '✓ Link copiado!' : '🔗 Compartilhar'}
          </button>
          <button onClick={referProfessional}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#ddd', background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 99, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}>
            👥 Indicar um profissional
          </button>
        </div>

        {/* Media */}
        {(demand.media_urls?.length ?? 0) > 0 && (
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

                {/* Tipo de preço */}
                <p style={{ fontSize: 13, color: '#888', margin: '16px 0 8px', fontWeight: 600 }}>Como você quer cobrar?</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    { key: 'fixed',      label: 'Preço fixo'   },
                    { key: 'hourly',     label: 'Preço por hora' },
                    { key: 'negotiable', label: 'A combinar'   },
                  ] as { key: PriceType; label: string }[]).map(opt => {
                    const active = priceType === opt.key
                    return (
                      <button key={opt.key} type="button" onClick={() => setPriceType(opt.key)}
                        style={{ flex: 1, minWidth: 100, height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                          border: `1px solid ${active ? '#00d4ff' : '#2a2a2a'}`,
                          background: active ? 'rgba(0,212,255,0.1)' : '#111',
                          color: active ? '#00d4ff' : '#888' }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {/* Valor (oculto se "A combinar") */}
                {priceType !== 'negotiable' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, background: '#111', border: '1px solid #333', borderRadius: 8, padding: '0 14px' }}>
                    <span style={{ fontSize: 15, color: '#888', fontWeight: 700 }}>R$</span>
                    <input
                      type="text" inputMode="decimal" value={priceAmount}
                      onChange={e => setPriceAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                      placeholder={priceType === 'hourly' ? 'valor por hora (ex: 50)' : 'valor do serviço (ex: 250)'}
                      style={{ flex: 1, height: 46, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontFamily: 'inherit' }}
                    />
                    {priceType === 'hourly' && <span style={{ fontSize: 13, color: '#666' }}>/hora</span>}
                  </div>
                )}

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
                onClick={startApply}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
                Candidaturas
                {applications.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 13, color: '#00d4ff', fontWeight: 700, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 99, padding: '2px 10px' }}>
                    {applications.length}
                  </span>
                )}
              </h2>

              {demand.status === 'open' ? (
                <button onClick={closeDemand} disabled={closing}
                  style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: 13, fontWeight: 800, cursor: closing ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {closing
                    ? <span style={{ width: 13, height: 13, border: '2px solid rgba(34,197,94,0.3)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                    : '✓'}
                  {closing ? 'Encerrando…' : 'Marcar como resolvido'}
                </button>
              ) : (
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 700, background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 99, padding: '5px 12px' }}>
                  Pedido encerrado
                </span>
              )}
            </div>

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
                    demandDesc={demand.description.slice(0, 60)}
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
                      demandDesc={demand.description.slice(0, 60)}
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
  app, onAccept, onDecline, accepting, demandDesc,
}: {
  app:        Application
  onAccept:   () => void
  onDecline:  () => void
  accepting:  boolean
  demandDesc: string
}) {
  const isPending  = app.status === 'pending'
  const isAccepted = app.status === 'accepted'
  const isRejected = app.status === 'rejected'
  const pp  = app.professional_profiles
  const usr = app.users
  const wa  = waLink(usr?.phone, usr?.phone_country_code,
    `Olá ${usr?.full_name ?? ''}! Vi sua candidatura no meu pedido "${demandDesc}" na Bikco e gostaria de conversar. 😊`)
  const skills = (pp?.skills ?? []).slice(0, 4)
  const price  = priceLabel(app.price_type, app.price_amount)

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
          {pp?.trust_score != null && pp.trust_score > 0 && (
            <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700 }}>score {Math.round(pp.trust_score)}</span>
          )}
          {isAccepted && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Aceito</span>}
          {isRejected && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>Recusado</span>}
        </div>
      </div>

      {/* Preço proposto */}
      {price && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '7px 12px' }}>
          <span style={{ fontSize: 15 }}>💰</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{price}</span>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {skills.map((s, i) => (
            <span key={i} style={{ fontSize: 11, color: '#9ca3af', background: '#111', border: '1px solid #222', borderRadius: 99, padding: '3px 9px' }}>{s}</span>
          ))}
        </div>
      )}

      {/* Bio */}
      {usr?.bio && (
        <p style={{ fontSize: 12.5, color: '#888', lineHeight: 1.55, margin: '0 0 12px' }}>{usr.bio}</p>
      )}

      {/* Application message */}
      <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.6, margin: '0 0 14px', padding: '12px 14px', background: '#111', borderRadius: 8 }}>
        {app.message}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isPending && (
          <button
            onClick={onAccept}
            disabled={accepting}
            style={{ flex: 1, minWidth: 120, height: 40, borderRadius: 8, border: 'none', background: accepting ? '#1a1a1a' : '#fff', color: accepting ? '#444' : '#000', fontSize: 13, fontWeight: 800, cursor: accepting ? 'not-allowed' : 'pointer' }}
          >
            {accepting ? '...' : 'Aceitar e abrir chat →'}
          </button>
        )}

        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            style={{ height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: '#25D366', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.898 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24.044 12.045.044 5.463.044.018 5.488.016 12.07a11.82 11.82 0 0 0 1.588 5.945L0 24l6.117-1.605a11.9 11.9 0 0 0 5.688 1.448h.005c6.581 0 11.987-5.443 11.989-12.027a11.95 11.95 0 0 0-3.279-8.367"/></svg>
            WhatsApp
          </a>
        ) : isPending && (
          <button
            onClick={onDecline}
            disabled={accepting}
            style={{ height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}
          >
            Recusar
          </button>
        )}

        {wa && isPending && (
          <button
            onClick={onDecline}
            disabled={accepting}
            style={{ height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}
          >
            Recusar
          </button>
        )}
      </div>

      {isAccepted && (
        <p style={{ fontSize: 12, color: '#22c55e', margin: '12px 0 0', fontWeight: 600 }}>
          ✓ Chat aberto com este profissional
        </p>
      )}
    </div>
  )
}
