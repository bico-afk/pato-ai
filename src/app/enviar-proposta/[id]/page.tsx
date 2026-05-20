'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface PostSummary {
  id: string
  title: string
  city: string | null
  urgency: string | null
  status: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}
interface ExistingProp {
  id: string
  tipo_cobranca: 'fixo' | 'hora' | 'visita' | null
  valor: number | null
  proposta: string | null
  status: string
  created_at: string
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const PALETTE = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return PALETTE[Math.abs(h) % PALETTE.length] }
function initials(n: string)    { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

const URGENCY_MAP: Record<string, { label: string; color: string }> = {
  hoje:        { label: 'Hoje — urgente', color: '#FF4D6A' },
  essa_semana: { label: 'Essa semana',    color: '#FF7A1A' },
  sem_pressa:  { label: 'Sem pressa',     color: '#22C55E' },
  flexivel:    { label: 'Sem pressa',     color: '#22C55E' },
}
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente:   { label: 'Aguardando resposta', color: '#888' },
  aceita:     { label: 'Proposta aceita ✓',   color: '#22C55E' },
  confirmada: { label: 'Você foi contratado! 🎉', color: '#FFD11A' },
  recusada:   { label: 'Proposta recusada',   color: '#f87171' },
}

/* ═══════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
function IcArrow() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> }
function IcPin()   { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> }
function IcCheck() { return <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function IcEdit()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }

function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  const n = name || '?'
  return <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(n)}</div>
}

type TipoCobranca = 'fixo' | 'hora' | 'visita'

const TIPOS: { value: TipoCobranca; icon: string; title: string; desc: string }[] = [
  { value: 'fixo',   icon: '💰', title: 'Valor fixo',       desc: 'Preço fechado pelo serviço completo' },
  { value: 'hora',   icon: '⏱️', title: 'Por hora',         desc: 'Taxa horária + estimativa de horas' },
  { value: 'visita', icon: '🔍', title: 'Visita técnica',   desc: 'Visito primeiro, orço depois' },
]

/* ═══════════════════════════════════════════════════════════
   SHARED STYLES
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
const FOCUS = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = '#FFD11A'
  e.target.style.boxShadow   = '0 0 0 3px rgba(255,209,26,0.08)'
}
const BLUR = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = '#272727'
  e.target.style.boxShadow   = 'none'
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function EnviarPropostaPage() {
  const router   = useRouter()
  const params   = useParams()
  const postId   = params.id as string
  const supabase = createClient()

  const [userId,      setUserId]      = useState<string | null>(null)
  const [post,        setPost]        = useState<PostSummary | null>(null)
  const [existing,    setExisting]    = useState<ExistingProp | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [editing,     setEditing]     = useState(false)

  // Form fields
  const [tipo,        setTipo]        = useState<TipoCobranca | ''>('')
  const [valor,       setValor]       = useState('')
  const [horasPH,     setHorasPH]     = useState('')   // valor por hora
  const [horas,       setHoras]       = useState('')   // horas estimadas
  const [disponib,    setDisponib]    = useState('')
  const [diferencial, setDiferencial] = useState('')
  const [mensagem,    setMensagem]    = useState('')

  /* ── Computed ── */
  const totalHoras = tipo === 'hora' && horasPH && horas
    ? (parseFloat(horasPH.replace(',', '.')) * parseFloat(horas.replace(',', '.'))).toFixed(2)
    : null

  const valorFinal = tipo === 'fixo' ? parseFloat(valor.replace(',', '.') || '0')
    : tipo === 'hora' ? (totalHoras ? parseFloat(totalHoras) : 0)
    : tipo === 'visita' ? parseFloat(valor.replace(',', '.') || '0')
    : 0

  const canSend = tipo !== '' && mensagem.trim().length >= 10 && (
    tipo === 'visita' ? true :
    tipo === 'fixo'   ? valor.trim() !== '' :
    tipo === 'hora'   ? horasPH.trim() !== '' && horas.trim() !== '' : false
  ) && !saving

  /* ── Init ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const uid = data.user.id
      setUserId(uid)

      // Load post summary
      const { data: p } = await supabase
        .from('posts')
        .select('id, title, city, urgency, status, profiles(id, full_name, avatar_url)')
        .eq('id', postId)
        .single()

      if (!p) { router.push('/feed'); return }
      setPost(p as unknown as PostSummary)

      // Check if post is closed
      if (p.status === 'fechado' || p.status === 'concluido') {
        setLoading(false)
        return
      }

      // Check if already submitted a proposal
      const { data: cand } = await supabase
        .from('candidaturas')
        .select('id, tipo_cobranca, valor, proposta, status, created_at')
        .eq('post_id', postId)
        .eq('prestador_id', uid)
        .maybeSingle()

      if (cand) {
        setExisting(cand as ExistingProp)
        // Pre-fill form for editing
        setTipo((cand.tipo_cobranca as TipoCobranca) || '')
        setValor(cand.valor?.toString() || '')
        setMensagem(cand.proposta || '')
      }

      setLoading(false)
    })
  }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Notify owner ── */
  async function notifyOwner(uid: string) {
    if (!post) return
    const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', uid).single()
    await supabase.from('notificacoes').insert({
      user_id: post.profiles.id,
      tipo:    'nova_proposta',
      titulo:  `🦆 Nova proposta de ${myProf?.full_name || 'um pato'}`,
      mensagem:`Para: "${post.title}"`,
      link:    `/propostas/${postId}`,
    })
  }

  /* ── Submit ── */
  async function submit() {
    if (!canSend || !userId || !post) return
    setSaving(true)
    setError(null)

    const valorNum = valorFinal > 0 ? valorFinal : null
    const horasNum = tipo === 'hora' && horas ? parseFloat(horas.replace(',', '.')) : null

    const payload = {
      post_id:      postId,
      prestador_id: userId,
      tipo_cobranca: tipo as TipoCobranca,
      valor:         valorNum,
      proposta:      mensagem.trim(),
      status:        'pendente',
    }

    // Try with extra columns first, fallback without
    const payloadFull = {
      ...payload,
      horas_estimadas: horasNum,
      disponibilidade: disponib.trim() || null,
      diferenciais:    diferencial.trim() || null,
    }

    let err = null
    if (existing && editing) {
      // Update existing
      const { error: e1 } = await supabase.from('candidaturas').update(payloadFull).eq('id', existing.id)
      if (e1) {
        const { error: e2 } = await supabase.from('candidaturas').update(payload).eq('id', existing.id)
        err = e2
      }
    } else if (!existing) {
      // Insert new
      const { error: e1 } = await supabase.from('candidaturas').insert(payloadFull)
      if (e1) {
        const { error: e2 } = await supabase.from('candidaturas').insert(payload)
        err = e2
      }
    }

    if (err) {
      setError('Erro ao enviar proposta: ' + err.message)
      setSaving(false)
      return
    }

    await notifyOwner(userId)
    setSuccess(true)
    setSaving(false)
  }

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1e1e1e', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ─── Success screen ─── */
  if (success) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 20, animation: 'bounce .6s ease' }}>🦆</div>
      <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
        Proposta enviada!
      </h2>
      <p style={{ margin: '0 0 8px', fontSize: 15, color: '#555', lineHeight: 1.5 }}>
        O contratante vai avaliar e responder em breve.
      </p>
      <p style={{ margin: '0 0 32px', fontSize: 13, color: '#333' }}>
        Você será notificado quando houver resposta.
      </p>
      <button
        onClick={() => router.push('/feed')}
        style={{ height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 16, fontWeight: 800, cursor: 'pointer', padding: '0 32px', fontFamily: 'inherit' }}
      >
        Voltar ao feed
      </button>
      <button
        onClick={() => router.push(`/post/${postId}`)}
        style={{ marginTop: 12, height: 44, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Ver o post
      </button>
      <style>{`@keyframes bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.2)}60%{transform:scale(.95)}}`}</style>
    </div>
  )

  /* ─── Proposta já existente (não editando) ─── */
  if (existing && !editing) {
    const st = STATUS_MAP[existing.status] ?? { label: existing.status, color: '#888' }
    return (
      <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 420, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
              <IcArrow /> voltar
            </button>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Minha proposta</span>
            <div style={{ width: 60 }} />
          </div>
        </header>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status */}
          <div style={{ backgroundColor: '#171717', borderRadius: 16, padding: '20px', textAlign: 'center', border: `1px solid ${st.color}33` }}>
            <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: st.color }}>
              {st.label}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
              Enviada {new Date(existing.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Post */}
          {post && <PostCard post={post} />}

          {/* Detalhes */}
          <div style={{ backgroundColor: '#171717', borderRadius: 16, padding: '16px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sua proposta</p>
            {existing.tipo_cobranca && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#555' }}>Tipo</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {existing.tipo_cobranca === 'fixo' ? '💰 Valor fixo' : existing.tipo_cobranca === 'hora' ? '⏱️ Por hora' : '🔍 Visita técnica'}
                </span>
              </div>
            )}
            {existing.valor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#555' }}>Valor</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#FFD11A' }}>R$ {existing.valor}</span>
              </div>
            )}
            {existing.proposta && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #222' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mensagem</p>
                <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>{existing.proposta}</p>
              </div>
            )}
          </div>

          {/* Ações */}
          {existing.status === 'pendente' && (
            <button
              onClick={() => setEditing(true)}
              style={{ height: 52, borderRadius: 14, border: '1.5px solid #272727', backgroundColor: 'transparent', color: '#FFD11A', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <IcEdit /> Editar proposta
            </button>
          )}
          {existing.status === 'confirmada' && (
            <button
              onClick={async () => {
                const { data: conv } = await supabase.from('conversas').select('id').eq('post_id', postId).eq('prestador_id', userId!).maybeSingle()
                if (conv?.id) router.push(`/chat/${conv.id}`)
                else router.push(`/post/${postId}`)
              }}
              style={{ height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              💬 Ir para o chat
            </button>
          )}
          <button onClick={() => router.push('/feed')} style={{ height: 44, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Voltar ao feed
          </button>
        </div>
        <style>{`*{box-sizing:border-box}body{margin:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ─── Post fechado ─── */
  if (post?.status === 'fechado' || post?.status === 'concluido') return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <p style={{ fontSize: 52, marginBottom: 12 }}>🔒</p>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff' }}>Bico fechado</h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: '#555' }}>Este bico já foi fechado. Veja outros no feed.</p>
      <button onClick={() => router.push('/feed')} style={{ height: 48, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontFamily: 'inherit' }}>
        Ver feed
      </button>
    </div>
  )

  /* ─── Main form ─── */
  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 420, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ══ HEADER ══ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
            <IcArrow /> voltar
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
            {editing ? 'Editar proposta' : 'Enviar proposta'}
          </span>
          <div style={{ width: 60 }} />
        </div>
      </header>

      <div style={{ padding: '20px 20px 88px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Resumo do post ── */}
        {post && <PostCard post={post} />}

        {/* ── Tipo de proposta ── */}
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            TIPO DE PROPOSTA
          </p>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px' }}>
            Como você quer cobrar?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIPOS.map(t => {
              const sel = tipo === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, textAlign: 'left',
                    border: `1.5px solid ${sel ? '#FFD11A' : '#242424'}`,
                    backgroundColor: sel ? '#1A1A00' : '#141414',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    boxShadow: sel ? '0 0 16px rgba(255,209,26,0.08)' : 'none',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: sel ? '#FFD11A' : '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, transition: 'all 0.15s' }}>
                    {t.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: sel ? '#FFD11A' : '#fff' }}>{t.title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555', lineHeight: 1.4 }}>{t.desc}</p>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? '#FFD11A' : '#333'}`, backgroundColor: sel ? '#FFD11A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {sel && <IcCheck />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Campos dinâmicos ── */}
        {tipo === 'fixo' && (
          <div>
            <label style={LBL}>Valor total (R$) *</label>
            <input
              type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              placeholder="ex: 250,00"
              style={{ ...BASE, height: 56, padding: '0 16px', fontSize: 20, fontWeight: 700 }}
              onFocus={FOCUS} onBlur={BLUR}
            />
          </div>
        )}

        {tipo === 'hora' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={LBL}>Valor por hora (R$) *</label>
              <input
                type="number" inputMode="decimal" value={horasPH} onChange={e => setHorasPH(e.target.value)}
                placeholder="ex: 80,00"
                style={{ ...BASE, height: 56, padding: '0 16px' }}
                onFocus={FOCUS} onBlur={BLUR}
              />
            </div>
            <div>
              <label style={LBL}>Horas estimadas *</label>
              <input
                type="number" inputMode="decimal" value={horas} onChange={e => setHoras(e.target.value)}
                placeholder="ex: 3"
                style={{ ...BASE, height: 56, padding: '0 16px' }}
                onFocus={FOCUS} onBlur={BLUR}
              />
            </div>
            {totalHoras && parseFloat(totalHoras) > 0 && (
              <div style={{ backgroundColor: '#1A1A00', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #FFD11A33' }}>
                <span style={{ fontSize: 13, color: '#888' }}>Total estimado</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#FFD11A' }}>R$ {totalHoras}</span>
              </div>
            )}
          </div>
        )}

        {tipo === 'visita' && (
          <div>
            <label style={LBL}>Valor da visita técnica (R$)</label>
            <input
              type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              placeholder="ex: 80,00"
              style={{ ...BASE, height: 56, padding: '0 16px' }}
              onFocus={FOCUS} onBlur={BLUR}
            />
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#555', lineHeight: 1.5 }}>
              Após a visita você apresenta o orçamento final ao contratante.
            </p>
          </div>
        )}

        {/* ── Disponibilidade ── */}
        {tipo !== '' && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>DISPONIBILIDADE</p>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Quando você pode?</h3>
            <input
              type="text" value={disponib} onChange={e => setDisponib(e.target.value)}
              placeholder="ex: Amanhã a partir das 14h, ou qualquer dia útil"
              style={{ ...BASE, height: 56, padding: '0 16px' }}
              onFocus={FOCUS} onBlur={BLUR}
            />
          </div>
        )}

        {/* ── Diferenciais ── */}
        {tipo !== '' && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>DIFERENCIAIS</p>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Por que você é o pato certo?</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>Opcional — mas aumenta suas chances!</p>
            <textarea
              value={diferencial}
              onChange={e => setDiferencial(e.target.value.slice(0, 300))}
              placeholder="Fale sobre sua experiência, certificações, ferramentas..."
              rows={3}
              style={{ ...BASE, padding: '14px 16px', resize: 'none', lineHeight: 1.6 }}
              onFocus={FOCUS} onBlur={BLUR}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: diferencial.length > 250 ? '#FFD11A' : '#444', textAlign: 'right' }}>
              {diferencial.length}/300
            </p>
          </div>
        )}

        {/* ── Mensagem ── */}
        {tipo !== '' && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MENSAGEM</p>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#fff' }}>
              Mensagem para o contratante *
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>Apresente-se e diga como vai resolver o problema</p>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value.slice(0, 500))}
              placeholder="Apresente-se e explique como você vai resolver o problema..."
              rows={5}
              style={{ ...BASE, padding: '14px 16px', resize: 'none', lineHeight: 1.6 }}
              onFocus={FOCUS} onBlur={BLUR}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: mensagem.length > 450 ? '#FFD11A' : '#444', textAlign: 'right' }}>
              {mensagem.length}/500
            </p>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div style={{ padding: '13px 16px', borderRadius: 12, backgroundColor: '#1f0808', border: '1.5px solid #5c1a1a', color: '#f87171', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

      </div>

      {/* ══ BOTÃO FIXO BOTTOM ══ */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 420, backgroundColor: 'rgba(15,15,15,0.97)', backdropFilter: 'blur(14px)', borderTop: '1px solid #1a1a1a', padding: '12px 20px 24px', zIndex: 80 }}>
        <button
          onClick={submit}
          disabled={!canSend}
          style={{
            width: '100%', height: 56, borderRadius: 14, border: 'none',
            backgroundColor: canSend ? '#FFD11A' : '#1a1800',
            color: canSend ? '#0F0F0F' : '#3a3a00',
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px',
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              enviando…
            </>
          ) : (
            `${editing ? 'Atualizar' : 'Enviar'} proposta 🦆`
          )}
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        textarea { resize: none; }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%,100%{transform:scale(1)} 40%{transform:scale(1.2)} 60%{transform:scale(.95)} }
      `}</style>
    </div>
  )
}

/* ─── Post summary card ─── */
function PostCard({ post }: { post: PostSummary }) {
  const urgInfo = URGENCY_MAP[post.urgency ?? 'sem_pressa'] ?? { label: 'Sem pressa', color: '#22C55E' }
  return (
    <div style={{ backgroundColor: '#171717', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <Avatar src={post.profiles.avatar_url} name={post.profiles.full_name} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {post.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: '#666' }}>{post.profiles.full_name || 'Usuário'}</span>
          {post.city && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#555' }}>
              <IcPin />{post.city}
            </span>
          )}
          {post.urgency && (
            <span style={{ fontSize: 11, fontWeight: 700, color: urgInfo.color, backgroundColor: urgInfo.color + '20', borderRadius: 20, padding: '2px 8px' }}>
              {urgInfo.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
