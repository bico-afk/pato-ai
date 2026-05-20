'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Etapa {
  id: number
  label: string
  percentual: number
  status: 'pendente' | 'liberada'
  liberado_at: string | null
}

interface Pagamento {
  id: string
  contrato_id: string
  contratante_id: string
  prestador_id: string
  valor_total: number
  valor_liberado: number
  status: 'aguardando' | 'confirmado' | 'em_execucao' | 'concluido'
  pix_copia_cola: string | null
  qr_code_url: string | null
  asaas_payment_id: string | null
  etapas: Etapa[]
  created_at: string
}

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }
function fmt(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/* ─── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name, size = 40 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* ─── QR Code image (via public API or base64) ── */
function QRCodeImg({ data, size = 200 }: { data: string; size?: number }) {
  const encoded = encodeURIComponent(data)
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=0`}
        alt="QR Code Pix"
        width={size}
        height={size}
        style={{ display: 'block' }}
      />
    </div>
  )
}

/* ─── Countdown timer ─────────────────────────────────────── */
function Countdown({ createdAt }: { createdAt: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const expiry = new Date(createdAt).getTime() + 30 * 60 * 1000
    const tick = () => {
      const left = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      setSecs(left)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [createdAt])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  const expired = secs === 0

  return (
    <span style={{ fontSize: 12, color: expired ? '#FF4D6A' : '#888', fontWeight: 600 }}>
      {expired ? '⚠️ QR Code expirado' : `⏱ QR Code válido por ${m}:${String(s).padStart(2, '0')}`}
    </span>
  )
}

/* ─── Progress bar ──────────────────────────────────────── */
function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div style={{ height: 8, backgroundColor: '#272727', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#FFD11A', borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────── */
export default function PatoPayPage() {
  const router     = useRouter()
  const params     = useParams()
  const contratoId = params.contrato_id as string
  const supabase   = createClient()

  const [pagamento,    setPagamento]    = useState<Pagamento | null>(null)
  const [contratante,  setContratante]  = useState<Profile | null>(null)
  const [prestador,    setPrestador]    = useState<Profile | null>(null)
  const [postTitle,    setPostTitle]    = useState('')
  const [userId,       setUserId]       = useState<string | null>(null)
  const [phase,        setPhase]        = useState<'loading' | 'ready' | 'celebrating'>('loading')
  const [copied,       setCopied]       = useState(false)
  const [liberando,    setLiberando]    = useState<number | null>(null)
  const [simConfirm,   setSimConfirm]   = useState(false) // sandbox simulation

  const pagRef    = useRef<Pagamento | null>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const userIdRef = useRef<string | null>(null)

  /* ── Load profiles ── */
  const loadProfiles = useCallback(async (p: Pagamento) => {
    const [{ data: ct }, { data: pr }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', p.contratante_id).single(),
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', p.prestador_id).single(),
    ])
    if (ct) setContratante(ct as Profile)
    if (pr) setPrestador(pr as Profile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Poll payment status ── */
  const pollStatus = useCallback(async () => {
    const pag = pagRef.current
    if (!pag?.id || pag.status !== 'aguardando') return

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/pix/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ pagamento_id: pag.id }),
    })
    const json = await res.json()
    if (json.confirmado || json.status !== 'aguardando') {
      const { data: updated } = await supabase.from('pagamentos').select('*').eq('id', pag.id).single()
      if (updated) {
        setPagamento(updated as unknown as Pagamento)
        pagRef.current = updated as unknown as Pagamento
      }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Create / load pagamento ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      userIdRef.current = data.user.id

      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/pix/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ contrato_id: contratoId }),
      })
      const json = await res.json()
      if (json.pagamento) {
        const p = json.pagamento as Pagamento
        setPagamento(p)
        pagRef.current = p
        await loadProfiles(p)

        // Load post title via contrato
        const { data: ct } = await supabase.from('contratos').select('post_id').eq('id', contratoId).single()
        if (ct?.post_id) {
          const { data: post } = await supabase.from('posts').select('title').eq('id', ct.post_id).single()
          if (post) setPostTitle((post as { title: string }).title)
        }
      }
      setPhase('ready')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId])

  /* ── Start polling when pagamento is aguardando ── */
  useEffect(() => {
    if (pagamento?.status === 'aguardando' && pagamento.id) {
      pollRef.current = setInterval(pollStatus, 10000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pagamento?.status, pagamento?.id, pollStatus])

  /* ── Realtime: etapas updates ── */
  useEffect(() => {
    if (!pagamento?.id) return
    const channel = supabase
      .channel(`pag-${pagamento.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pagamentos', filter: `id=eq.${pagamento.id}` },
        (payload) => {
          const updated = payload.new as Pagamento
          setPagamento(prev => prev ? { ...prev, ...updated } : prev)
          pagRef.current = { ...(pagRef.current ?? ({} as Pagamento)), ...updated }
          if (updated.status === 'concluido') {
            setPhase('celebrating')
            setTimeout(() => setPhase('ready'), 4000)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamento?.id])

  /* ── Sandbox simulation: confirmar pagamento manualmente ── */
  async function simularConfirmacao() {
    if (!pagamento?.id) return
    setSimConfirm(true)
    await supabase.from('pagamentos').update({ status: 'confirmado' }).eq('id', pagamento.id)
    const { data: updated } = await supabase.from('pagamentos').select('*').eq('id', pagamento.id).single()
    if (updated) {
      setPagamento(updated as unknown as Pagamento)
      pagRef.current = updated as unknown as Pagamento
    }
    setSimConfirm(false)
  }

  /* ── Liberar etapa ── */
  async function liberarEtapa(etapa: Etapa) {
    if (!pagamento?.id || liberando !== null) return
    setLiberando(etapa.id)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/pix/liberar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ pagamento_id: pagamento.id, etapa_id: etapa.id }),
    })
    const json = await res.json()
    if (json.ok) {
      setPagamento(prev => prev ? {
        ...prev,
        etapas: json.etapas,
        valor_liberado: json.valor_liberado,
        status: json.status,
      } : prev)
      if (json.status === 'concluido') {
        setPhase('celebrating')
        setTimeout(() => setPhase('ready'), 4000)
      }
    }
    setLiberando(null)
  }

  /* ── Copiar Pix ── */
  function copiarPix() {
    if (!pagamento?.pix_copia_cola) return
    navigator.clipboard.writeText(pagamento.pix_copia_cola)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  /* ── Loading ── */
  if (phase === 'loading') return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── Celebrating ── */
  if (phase === 'celebrating') return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, animation: 'bounce 0.5s ease infinite alternate' }}>🦆</div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: '#fff' }}>Serviço concluído!</p>
        <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Valor total liberado com sucesso.</p>
      </div>
      <button
        onClick={() => router.push(`/avaliar/${contratoId}`)}
        style={{ width: '100%', maxWidth: 360, height: 54, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
      >
        Avaliar o serviço ⭐
      </button>
      <button onClick={() => setPhase('ready')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>
        Ver detalhes do pagamento
      </button>
      <style>{`
        @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-16px)}}
      `}</style>
    </div>
  )

  if (!pagamento) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#888' }}>Erro ao carregar pagamento</p>
      <button onClick={() => router.back()} style={{ color: '#FFD11A', background: 'none', border: 'none', cursor: 'pointer' }}>← Voltar</button>
    </div>
  )

  const isContratante = pagamento.contratante_id === userId
  const etapas: Etapa[] = pagamento.etapas ?? []
  const totalLiberado = pagamento.valor_liberado ?? 0
  const valorTotal = pagamento.valor_total ?? 0

  const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
    aguardando:   { label: 'Aguardando Pix',     color: '#888',    bg: '#1e1e1e' },
    confirmado:   { label: 'Pago ✓',             color: '#22C55E', bg: '#0d2a0d' },
    em_execucao:  { label: 'Em execução',         color: '#3B82F6', bg: '#0a1a2e' },
    concluido:    { label: 'Concluído 🎉',        color: '#FFD11A', bg: '#1a1500' },
  }
  const statusInfo = STATUS_LABEL[pagamento.status] ?? STATUS_LABEL.aguardando

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 48 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Pato Pay</span>
        <span style={{ fontSize: 22 }}>🦆</span>
      </div>

      {/* ─── Resumo do contrato ─── */}
      <div style={{ margin: '12px 16px', backgroundColor: '#171717', borderRadius: 16, padding: '16px', border: '1px solid #222' }}>
        {postTitle && (
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#fff', borderBottom: '1px solid #252525', paddingBottom: 10 }}>
            📋 {postTitle}
          </p>
        )}

        {/* Partes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar src={contratante?.avatar_url ?? null} name={contratante?.full_name ?? null} size={36} />
            <div>
              <p style={{ margin: 0, fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>CONTRATANTE</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{contratante?.full_name || '—'}</p>
            </div>
          </div>
          <div style={{ fontSize: 16, color: '#444' }}>→</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar src={prestador?.avatar_url ?? null} name={prestador?.full_name ?? null} size={36} />
            <div>
              <p style={{ margin: 0, fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>PRESTADOR</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{prestador?.full_name || '—'}</p>
            </div>
          </div>
        </div>

        {/* Valor + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>VALOR TOTAL</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#FFD11A', lineHeight: 1 }}>R$ {fmt(valorTotal)}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: statusInfo.color, backgroundColor: statusInfo.bg, borderRadius: 20, padding: '4px 12px' }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* ESTADO 1 — AGUARDANDO PAGAMENTO                */}
      {/* ═══════════════════════════════════════════════ */}
      {pagamento.status === 'aguardando' && (
        <div style={{ margin: '0 16px', backgroundColor: '#171717', borderRadius: 16, padding: '20px 16px', border: '1px solid #222' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#fff' }}>Realize o pagamento via Pix</p>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#555' }}>Escaneie o QR Code ou copie o código</p>

          {/* Valor destaque */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: '#FFD11A' }}>R$ {fmt(valorTotal)}</p>
          </div>

          {/* QR Code */}
          {pagamento.pix_copia_cola && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {pagamento.qr_code_url ? (
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pagamento.qr_code_url} alt="QR Code" width={200} height={200} />
                </div>
              ) : (
                <QRCodeImg data={pagamento.pix_copia_cola} size={200} />
              )}
            </div>
          )}

          {/* Timer */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Countdown createdAt={pagamento.created_at} />
          </div>

          {/* Código copia e cola */}
          {pagamento.pix_copia_cola && (
            <div style={{ backgroundColor: '#0f0f0f', borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: '1px solid #272727', wordBreak: 'break-all' }}>
              <p style={{ margin: 0, fontSize: 10, color: '#444', lineHeight: 1.7, fontFamily: 'monospace' }}>
                {pagamento.pix_copia_cola}
              </p>
            </div>
          )}

          {/* Botão copiar */}
          <button
            onClick={copiarPix}
            style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid #272727', backgroundColor: copied ? '#0d2a0d' : '#1e1e1e', color: copied ? '#22C55E' : '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16, transition: 'all 0.2s' }}
          >
            {copied ? '✓ Código copiado!' : '📋 Copiar código Pix'}
          </button>

          {/* Segurança */}
          <div style={{ backgroundColor: '#0d1500', borderRadius: 10, padding: '10px 14px', border: '1px solid #FFD11A22', marginBottom: 16 }}>
            <p style={{ margin: '0 0 3px', fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
              🔒 O valor fica retido com segurança até o serviço ser concluído
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#666' }}>Pagamento seguro garantido pelo Pato AI</p>
          </div>

          {/* Sandbox simulation */}
          <div style={{ backgroundColor: '#1a0a00', borderRadius: 10, padding: '10px 14px', border: '1px solid #FF7A1A33' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#FF7A1A' }}>🧪 MODO SANDBOX</p>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#666' }}>Em produção o Pix é confirmado automaticamente. Aqui você pode simular:</p>
            <button
              onClick={simularConfirmacao}
              disabled={simConfirm}
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #FF7A1A44', backgroundColor: 'transparent', color: '#FF7A1A', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: simConfirm ? 0.6 : 1 }}
            >
              {simConfirm ? 'Confirmando...' : '⚡ Simular pagamento confirmado'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ESTADO 2+ — PAGAMENTO CONFIRMADO               */}
      {/* ═══════════════════════════════════════════════ */}
      {pagamento.status !== 'aguardando' && (
        <>
          {/* Badge confirmado */}
          <div style={{ margin: '0 16px 12px', backgroundColor: '#0d2a0d', borderRadius: 12, padding: '12px 16px', border: '1px solid #22C55E33', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#22C55E' }}>Pagamento confirmado</p>
              <p style={{ margin: 0, fontSize: 12, color: '#555' }}>O valor está retido com segurança. Libere por etapas conforme o serviço avança.</p>
            </div>
          </div>

          {/* Barra de progresso (visão do prestador destaque) */}
          {!isContratante && (
            <div style={{ margin: '0 16px 12px', backgroundColor: '#171717', borderRadius: 12, padding: '14px 16px', border: '1px solid #222' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Seu pagamento</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 700 }}>R$ {fmt(totalLiberado)} liberado</span>
                <span style={{ fontSize: 12, color: '#555' }}>de R$ {fmt(valorTotal)} total</span>
              </div>
              <ProgressBar value={totalLiberado} total={valorTotal} />
            </div>
          )}

          {/* Etapas */}
          <div style={{ margin: '0 16px', backgroundColor: '#171717', borderRadius: 16, padding: '16px', border: '1px solid #222' }}>
            <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: '#fff' }}>
              {isContratante ? '🔓 Liberação por etapas' : '💸 Status dos pagamentos'}
            </p>

            {/* Progress bar para contratante */}
            {isContratante && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>Liberado</span>
                  <span style={{ fontSize: 12, color: '#FFD11A', fontWeight: 700 }}>R$ {fmt(totalLiberado)} / R$ {fmt(valorTotal)}</span>
                </div>
                <ProgressBar value={totalLiberado} total={valorTotal} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {etapas.map((etapa, idx) => {
                const valorEtapa = Math.round(valorTotal * etapa.percentual / 100 * 100) / 100
                const jaLiberada = etapa.status === 'liberada'
                // Só pode liberar em ordem
                const anteriorLiberada = idx === 0 || etapas[idx - 1].status === 'liberada'
                const podeLiberar = isContratante && !jaLiberada && anteriorLiberada && pagamento.status !== 'aguardando'

                return (
                  <div key={etapa.id} style={{
                    backgroundColor: jaLiberada ? '#0d2a0d' : '#1e1e1e',
                    borderRadius: 12,
                    padding: '12px 14px',
                    border: `1px solid ${jaLiberada ? '#22C55E33' : podeLiberar ? '#FFD11A33' : '#2a2a2a'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: jaLiberada ? 4 : 0 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: jaLiberada ? '#22C55E' : '#fff' }}>
                            {jaLiberada ? '✅' : `${idx + 1}.`} {etapa.label}
                          </span>
                          <span style={{ fontSize: 10, color: '#555', backgroundColor: '#2a2a2a', borderRadius: 4, padding: '1px 6px' }}>
                            {etapa.percentual}%
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, color: jaLiberada ? '#22C55E' : '#FFD11A' }}>
                          R$ {fmt(valorEtapa)}
                        </p>
                      </div>

                      {/* Botão liberar (contratante) */}
                      {podeLiberar && (
                        <button
                          onClick={() => liberarEtapa(etapa)}
                          disabled={liberando !== null}
                          style={{ backgroundColor: '#FFD11A', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#0F0F0F', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: liberando === etapa.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                          {liberando === etapa.id ? (
                            <><div style={{ width: 12, height: 12, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Liberando...</>
                          ) : (
                            <>🔓 Liberar R$ {fmt(valorEtapa)}</>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Status liberada */}
                    {jaLiberada && etapa.liberado_at && (
                      <p style={{ margin: 0, fontSize: 11, color: '#555' }}>
                        {isContratante ? 'Liberado em' : 'Recebido em'} {new Date(etapa.liberado_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {/* Aguardando (prestador) */}
                    {!jaLiberada && !isContratante && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>Aguardando liberação do contratante</p>
                    )}

                    {/* Aguardando etapa anterior (contratante) */}
                    {!jaLiberada && !podeLiberar && isContratante && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>
                        {pagamento.status === 'aguardando' ? 'Aguardando confirmação do pagamento' : 'Libere as etapas anteriores primeiro'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Concluído */}
            {pagamento.status === 'concluido' && (
              <div style={{ marginTop: 16, backgroundColor: '#1a1500', borderRadius: 12, padding: '14px 16px', border: '1px solid #FFD11A33', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#FFD11A' }}>🎉 Valor total liberado!</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>Serviço concluído com sucesso</p>
                <button
                  onClick={() => router.push(`/avaliar/${contratoId}`)}
                  style={{ backgroundColor: '#FFD11A', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#0F0F0F', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Avaliar o serviço ⭐
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
