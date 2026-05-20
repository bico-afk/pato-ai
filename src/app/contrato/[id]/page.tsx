'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  city: string | null
}

interface Contrato {
  id: string
  conteudo: string
  status: string
  created_at: string
  chat_id: string | null
  candidatura_id: string | null
  post_id: string | null
  contratante_id: string
  prestador_id: string
  assinado_contratante: boolean
  assinado_contratante_at: string | null
  assinado_prestador: boolean
  assinado_prestador_at: string | null
  valor: number | null
  prazo: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

function fmt(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: 'Pendente',      color: '#888',    bg: '#1e1e1e' },
  assinado:   { label: 'Assinado',      color: '#22C55E', bg: '#0d2a0d' },
  em_execucao:{ label: 'Em execução',   color: '#3B82F6', bg: '#0a1a2e' },
  concluido:  { label: 'Concluído',     color: '#FFD11A', bg: '#1a1500' },
}

/* ─── Sub-components ─────────────────────────────────────── */
function Avatar({ src, name, size = 40 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* Renders contract sections with styled headings */
function ContractText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} style={{ height: 10 }} />

        // Main title (all caps, starts with "CONTRATO")
        if (trimmed.startsWith('CONTRATO') && trimmed === trimmed.toUpperCase() && trimmed.length < 60) {
          return (
            <h2 key={i} style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 900, color: '#fff', textAlign: 'center', letterSpacing: '0.05em', borderBottom: '1px solid #2a2a2a', paddingBottom: 12 }}>
              {trimmed}
            </h2>
          )
        }

        // Section headings (all caps, numbered or known keywords)
        const isSectionHeading = (
          (trimmed === trimmed.toUpperCase() && trimmed.length < 70 && /^\d|^[IVXLC]+\./.test(trimmed)) ||
          /^(IDENTIFICAÇÃO|DESCRIÇÃO|VALOR|PRAZO|OBRIGAÇÕES|CONDIÇÕES|FORO|CLÁUSULA|RESCISÃO|PENALIDADES|GARANTIAS|OBJETO)/i.test(trimmed)
        ) && trimmed === trimmed.toUpperCase()

        if (isSectionHeading) {
          return (
            <h3 key={i} style={{ margin: '18px 0 8px', fontSize: 12, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.06em' }}>
              {trimmed}
            </h3>
          )
        }

        // Numbered clauses (e.g. "1.1 ..." or "§1...")
        if (/^\d+\.\d+|^§\s*\d/.test(trimmed)) {
          return (
            <p key={i} style={{ margin: '4px 0', fontSize: 12.5, color: '#ccc', lineHeight: 1.75, paddingLeft: 4 }}>
              {trimmed}
            </p>
          )
        }

        // Signature area
        if (/assinatura|data:|local:/i.test(trimmed)) {
          return (
            <p key={i} style={{ margin: '3px 0', fontSize: 12, color: '#777', lineHeight: 1.7, fontStyle: 'italic' }}>
              {trimmed}
            </p>
          )
        }

        return (
          <p key={i} style={{ margin: '3px 0', fontSize: 12.5, color: '#bbb', lineHeight: 1.75 }}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function ContratoPage() {
  const router   = useRouter()
  const params   = useParams()
  const chatId   = params.id as string      // param is the chat_id
  const supabase = createClient()

  const [contrato,    setContrato]    = useState<Contrato | null>(null)
  const [contratante, setContratante] = useState<Profile | null>(null)
  const [prestador,   setPrestador]   = useState<Profile | null>(null)
  const [postTitle,   setPostTitle]   = useState<string>('')
  const [userId,      setUserId]      = useState<string | null>(null)
  const [phase,       setPhase]       = useState<'loading' | 'generating' | 'ready' | 'celebrating'>('loading')
  const [assinando,   setAssinando]   = useState(false)
  const [genError,    setGenError]    = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)

  /* ── Load existing contract ── */
  const loadContrato = useCallback(async (uid: string) => {
    // Try chat_id field first, then treat param as direct contrato id
    let c: Contrato | null = null

    const { data: c1 } = await supabase.from('contratos')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle()

    if (c1) {
      c = c1 as unknown as Contrato
    } else {
      // Maybe it's a direct contrato id (backward compat)
      const { data: c2 } = await supabase.from('contratos')
        .select('*')
        .eq('id', chatId)
        .maybeSingle()
      if (c2) c = c2 as unknown as Contrato
    }

    if (c) {
      setContrato(c)
      await loadProfiles(c)
      setPhase('ready')
      return true
    }
    return false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  /* ── Load profiles for a contract ── */
  const loadProfiles = useCallback(async (c: Contrato) => {
    const [{ data: ct }, { data: pr }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, city').eq('id', c.contratante_id).single(),
      supabase.from('profiles').select('id, full_name, avatar_url, city').eq('id', c.prestador_id).single(),
    ])
    if (ct) setContratante(ct as Profile)
    if (pr) setPrestador(pr as Profile)

    if (c.post_id) {
      const { data: p } = await supabase.from('posts').select('title').eq('id', c.post_id).single()
      if (p) setPostTitle((p as { title: string }).title)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Generate contract via API ── */
  const generateContrato = useCallback(async () => {
    setPhase('generating')
    setGenError(null)

    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/gerar-contrato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ chat_id: chatId }),
      })
      const json = await res.json()
      if (json.error) { setGenError(json.error); setPhase('ready'); return }

      // Reload the saved contract
      if (json.id) {
        const { data: saved } = await supabase.from('contratos').select('*').eq('id', json.id).single()
        if (saved) {
          setContrato(saved as unknown as Contrato)
          await loadProfiles(saved as unknown as Contrato)
        }
      } else {
        // API returned text but couldn't save — create a temp display
        setContrato({
          id: 'temp',
          conteudo: json.conteudo,
          status: 'pendente',
          created_at: new Date().toISOString(),
          chat_id: chatId,
          candidatura_id: null,
          post_id: null,
          contratante_id: '',
          prestador_id: '',
          assinado_contratante: false,
          assinado_contratante_at: null,
          assinado_prestador: false,
          assinado_prestador_at: null,
          valor: null,
          prazo: null,
        })
      }
      setPhase('ready')
    } catch (e) {
      setGenError('Erro de conexão. Tente novamente.')
      setPhase('ready')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  /* ── Initial load ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)

      const found = await loadContrato(data.user.id)
      if (!found) await generateContrato()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  /* ── Realtime: signature updates ── */
  useEffect(() => {
    if (!contrato || contrato.id === 'temp') return

    const channel = supabase
      .channel(`contrato-${contrato.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contratos', filter: `id=eq.${contrato.id}` },
        (payload) => {
          const updated = payload.new as Contrato
          setContrato(prev => prev ? { ...prev, ...updated } : prev)
          if (updated.assinado_contratante && updated.assinado_prestador) {
            setPhase('celebrating')
            setTimeout(() => setPhase('ready'), 3500)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato?.id])

  /* ── Sign ── */
  async function assinar() {
    if (!contrato || !userId || assinando || contrato.id === 'temp') return
    setAssinando(true)

    const isContratante = contrato.contratante_id === userId
    const field   = isContratante ? 'assinado_contratante'    : 'assinado_prestador'
    const tsField = isContratante ? 'assinado_contratante_at' : 'assinado_prestador_at'
    const otherSigned = isContratante ? contrato.assinado_prestador : contrato.assinado_contratante

    const updates: Record<string, unknown> = {
      [field]: true,
      [tsField]: new Date().toISOString(),
    }
    if (otherSigned) updates.status = 'assinado'

    const { data: updated } = await supabase.from('contratos').update(updates).eq('id', contrato.id).select('*').single()
    if (updated) {
      setContrato(prev => prev ? { ...prev, ...(updated as unknown as Contrato) } : prev)
      if (otherSigned) setPhase('celebrating')
    }

    // Notify other party
    const otherId  = isContratante ? contrato.prestador_id : contrato.contratante_id
    const myName   = isContratante ? contratante?.full_name : prestador?.full_name
    await supabase.from('notificacoes').insert({
      user_id: otherId,
      tipo: 'contrato_assinado',
      titulo: otherSigned ? '🎉 Contrato assinado por ambos!' : '✍️ Contrato assinado por uma das partes',
      mensagem: otherSigned
        ? `${myName || 'A outra parte'} assinou. O contrato está completo!`
        : `${myName || 'A outra parte'} assinou o contrato. Sua vez!`,
      link: `/contrato/${chatId}`,
      lida: false,
    }).then(() => {})

    setAssinando(false)
  }

  /* ── Phase: Loading / Generating ── */
  if (phase === 'loading' || phase === 'generating') {
    return (
      <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, maxWidth: 480, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <div style={{ width: 80, height: 80, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 1s linear infinite', position: 'absolute' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🦆</div>
        </div>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {phase === 'loading' ? 'Carregando contrato...' : 'A IA está gerando seu contrato...'}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
            {phase === 'loading' ? 'Aguarde um momento' : 'Isso leva apenas alguns segundos'}
          </p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Phase: Celebrating ── */
  if (phase === 'celebrating' && contrato) {
    return (
      <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, maxWidth: 480, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, animation: 'bounce 0.6s ease infinite alternate' }}>🎉</div>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#fff' }}>Contrato assinado!</p>
          <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Agora é hora de pagar.</p>
        </div>
        <button
          onClick={() => router.push(`/pato-pay/${contrato.id}`)}
          style={{ width: '100%', height: 54, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          Realizar pagamento via Pix 🦆
        </button>
        <button onClick={() => setPhase('ready')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>
          Ver contrato
        </button>
        <style>{`
          @keyframes bounce{from{transform:translateY(0) scale(1)} to{transform:translateY(-14px) scale(1.1)}}
        `}</style>
      </div>
    )
  }

  /* ── Phase: Ready ── */
  if (!contrato) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px' }}>
      {genError && (
        <div style={{ backgroundColor: '#2a0511', borderRadius: 12, padding: '14px 18px', maxWidth: 360, textAlign: 'center', border: '1px solid #FF4D6A33' }}>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: '#FF4D6A', fontWeight: 700 }}>Erro ao gerar contrato</p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888' }}>{genError}</p>
          <button onClick={generateContrato} style={{ backgroundColor: '#FFD11A', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            Tentar novamente
          </button>
        </div>
      )}
      {!genError && <p style={{ color: '#888' }}>Contrato não encontrado</p>}
      <button onClick={() => router.back()} style={{ color: '#FFD11A', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
    </div>
  )

  const isContratante = contrato.contratante_id === userId
  const iSigned       = isContratante ? contrato.assinado_contratante : contrato.assinado_prestador
  const bothSigned    = contrato.assinado_contratante && contrato.assinado_prestador
  const statusInfo    = STATUS_MAP[contrato.status] ?? STATUS_MAP.pendente

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 48 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: '#0F0F0F', zIndex: 20, borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Contrato</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, backgroundColor: statusInfo.bg, borderRadius: 20, padding: '3px 10px' }}>
          {statusInfo.label}
        </span>
      </div>

      {/* ─── Summary card ─── */}
      <div style={{ margin: '12px 16px', backgroundColor: '#171717', borderRadius: 16, padding: '16px', border: '1px solid #222' }}>
        {postTitle && (
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#fff', borderBottom: '1px solid #252525', paddingBottom: 10 }}>
            📋 {postTitle}
          </p>
        )}

        {/* Parties */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {/* Contratante */}
          <div style={{ flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CONTRATANTE</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar src={contratante?.avatar_url ?? null} name={contratante?.full_name ?? null} size={32} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contratante?.full_name || '—'}</p>
                {contratante?.city && <p style={{ margin: 0, fontSize: 10, color: '#555' }}>{contratante.city}</p>}
              </div>
            </div>
          </div>

          {/* Prestador */}
          <div style={{ flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>PRESTADOR</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar src={prestador?.avatar_url ?? null} name={prestador?.full_name ?? null} size={32} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prestador?.full_name || '—'}</p>
                {prestador?.city && <p style={{ margin: 0, fontSize: 10, color: '#555' }}>{prestador.city}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Value + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {contrato.valor ? (
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>VALOR</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFD11A' }}>R$ {fmt(contrato.valor)}</p>
            </div>
          ) : <div />}
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 9, color: '#444' }}>Gerado em</p>
            <p style={{ margin: 0, fontSize: 11, color: '#666' }}>{new Date(contrato.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* ─── Signature status ─── */}
      <div style={{ margin: '0 16px 12px', backgroundColor: '#171717', borderRadius: 12, padding: '12px 14px', border: '1px solid #222' }}>
        <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status das assinaturas</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Contratante', profile: contratante, signed: contrato.assinado_contratante, at: contrato.assinado_contratante_at },
            { label: 'Prestador',   profile: prestador,   signed: contrato.assinado_prestador,   at: contrato.assinado_prestador_at },
          ].map(p => (
            <div key={p.label} style={{ flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, padding: '10px 12px', border: `1px solid ${p.signed ? '#22C55E33' : '#2a2a2a'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 13 }}>{p.signed ? '✅' : '○'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: p.signed ? '#22C55E' : '#555' }}>
                  {p.signed ? 'Assinou' : 'Pendente'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#555' }}>{p.label}</p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile?.full_name || '—'}</p>
              {p.signed && p.at && (
                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#444' }}>{new Date(p.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Contract text ─── */}
      <div style={{ margin: '0 16px 16px', backgroundColor: '#171717', borderRadius: 12, padding: '20px 16px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #252525' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Texto do contrato</span>
          <button
            onClick={() => { navigator.clipboard.writeText(contrato.conteudo); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ background: 'none', border: '1px solid #272727', borderRadius: 6, color: copied ? '#22C55E' : '#666', fontSize: 11, cursor: 'pointer', padding: '4px 10px' }}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <ContractText text={contrato.conteudo} />
      </div>

      {/* ─── Sign / Status button ─── */}
      <div style={{ padding: '0 16px' }}>
        {bothSigned ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ backgroundColor: '#0d2a0d', borderRadius: 14, padding: '14px 16px', border: '1px solid #22C55E33', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#22C55E' }}>✅ Contrato assinado por ambas as partes</p>
              <p style={{ margin: 0, fontSize: 12, color: '#555' }}>Documento com validade jurídica digital</p>
            </div>
            <button
              onClick={() => router.push(`/pato-pay/${contrato.id}`)}
              style={{ width: '100%', height: 54, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              Ir para o pagamento →
            </button>
          </div>
        ) : !iSigned ? (
          <button
            onClick={assinar}
            disabled={assinando || contrato.id === 'temp'}
            style={{ width: '100%', height: 54, borderRadius: 14, border: 'none', backgroundColor: contrato.id === 'temp' ? '#1a1a1a' : '#FFD11A', color: contrato.id === 'temp' ? '#555' : '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: assinando || contrato.id === 'temp' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: assinando ? 0.7 : 1 }}
          >
            {assinando ? (
              <><div style={{ width: 18, height: 18, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Assinando...</>
            ) : contrato.id === 'temp' ? (
              '⚠️ Salve o contrato primeiro'
            ) : (
              'Assinar contrato ✍️'
            )}
          </button>
        ) : (
          <div style={{ backgroundColor: '#0d1500', borderRadius: 14, padding: '14px 16px', border: '1px solid #22C55E33', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#22C55E' }}>✅ Você assinou · Aguardando outra parte</p>
            <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
              {isContratante ? prestador?.full_name : contratante?.full_name} ainda não assinou.
              Será notificado automaticamente.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
