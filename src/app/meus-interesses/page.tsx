'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Interesse {
  id: string
  status: string
  tipo: string | null
  valor: number | null
  horas_estimadas: number | null
  disponibilidade: string | null
  diferenciais: string | null
  proposta: string | null
  mensagem: string | null
  created_at: string
  post_id: string
  post_title: string
  post_city: string | null
  post_status: string
  contratante_id: string
  contratante_name: string | null
  contratante_avatar: string | null
  contratante_seal: string | null
  chat_id: string | null
}

type FilterKey = 'todos' | 'pendente' | 'aceita' | 'recusada'

/* ─── Constants ──────────────────────────────────────────── */
const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: 'Pendente',    color: '#FFD11A', bg: '#1a1500' },
  aceita:     { label: 'Aceito ✅',   color: '#22C55E', bg: '#0d2a0d' },
  confirmada: { label: 'Contratado 🎉', color: '#FFD11A', bg: '#1a1500' },
  recusada:   { label: 'Recusado',    color: '#f87171', bg: '#2a0d0d' },
}

const TIPO_LABEL: Record<string, string> = {
  fixo:   '💰 Valor fixo',
  hora:   '⏱️ Por hora',
  visita: '🔍 Visita técnica',
}

const SEAL_COLOR: Record<string, string> = {
  ouro: '#FFD11A', prata: '#C0C0C0', bronze: '#CD7F32',
}
const SEAL_LABEL: Record<string, string> = {
  ouro: 'OURO', prata: 'PRATA', bronze: 'BRONZE',
}

const FILTER_LABELS: { key: FilterKey; label: string; statusMatch: string[] }[] = [
  { key: 'todos',    label: 'Todos',     statusMatch: [] },
  { key: 'pendente', label: 'Pendentes', statusMatch: ['pendente'] },
  { key: 'aceita',   label: 'Aceitos',   statusMatch: ['aceita', 'confirmada'] },
  { key: 'recusada', label: 'Recusados', statusMatch: ['recusada'] },
]

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }
function fmt(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }

/* ─── Avatar component ───────────────────────────────────── */
function Avatar({ src, name, size = 36 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

/* ─── Edit Modal ─────────────────────────────────────────── */
function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: Interesse
  onClose: () => void
  onSaved: (updated: Partial<Interesse>) => void
}) {
  const supabase = createClient()
  const [tipo,        setTipo]        = useState(item.tipo ?? 'fixo')
  const [valor,       setValor]       = useState(item.valor ? String(item.valor) : '')
  const [horas,       setHoras]       = useState(item.horas_estimadas ? String(item.horas_estimadas) : '')
  const [disponib,    setDisponib]    = useState(item.disponibilidade ?? '')
  const [diferenciais,setDiferenciais] = useState(item.diferenciais ?? '')
  const [mensagem,    setMensagem]    = useState(item.mensagem ?? item.proposta ?? '')
  const [saving,      setSaving]      = useState(false)

  const totalHora = tipo === 'hora' && valor && horas
    ? parseFloat(valor) * parseFloat(horas)
    : null

  const canSave = mensagem.trim().length >= 10 && (
    tipo === 'visita' ? true : valor.length > 0
  )

  async function save() {
    if (!canSave || saving) return
    setSaving(true)

    const updates: Record<string, unknown> = {
      tipo,
      valor: valor ? parseFloat(valor) : null,
      mensagem: mensagem.trim(),
      disponibilidade: disponib.trim() || null,
      diferenciais: diferenciais.trim() || null,
    }
    if (tipo === 'hora') updates.horas_estimadas = horas ? parseFloat(horas) : null

    const { error } = await supabase.from('candidaturas').update(updates).eq('id', item.id)
    if (!error) {
      onSaved({ tipo, valor: valor ? parseFloat(valor) : null, mensagem: mensagem.trim(), disponibilidade: disponib || null, diferenciais: diferenciais || null, horas_estimadas: horas ? parseFloat(horas) : null })
      onClose()
    }
    setSaving(false)
  }

  const TIPOS = [
    { value: 'fixo',   icon: '💰', title: 'Valor fixo',      desc: 'Preço fechado pelo serviço' },
    { value: 'hora',   icon: '⏱️', title: 'Por hora',        desc: 'Taxa horária + estimativa' },
    { value: 'visita', icon: '🔍', title: 'Visita técnica',  desc: 'Visito primeiro, orço depois' },
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#1e1e1e', border: '1.5px solid #272727', borderRadius: 10,
    color: '#fff', fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, overflowY: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#0F0F0F', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 16px 40px', border: '1px solid #222', borderBottom: 'none', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: 0, fontFamily: 'inherit' }}>← Fechar</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>Editar proposta</span>
          <div style={{ width: 60 }} />
        </div>

        {/* Post title */}
        <div style={{ backgroundColor: '#171717', borderRadius: 10, padding: '10px 12px', marginBottom: 16, border: '1px solid #222' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Bico</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{item.post_title}</p>
        </div>

        {/* Tipo cards */}
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo de proposta</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {TIPOS.map(t => (
            <button key={t.value} onClick={() => setTipo(t.value)} style={{ flex: 1, padding: '10px 6px', borderRadius: 12, border: `1.5px solid ${tipo === t.value ? '#FFD11A' : '#272727'}`, backgroundColor: tipo === t.value ? '#1a1500' : 'transparent', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: tipo === t.value ? '#FFD11A' : '#888', lineHeight: 1.3 }}>{t.title}</p>
            </button>
          ))}
        </div>

        {/* Valor */}
        {tipo === 'fixo' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Valor total (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inputStyle} />
          </div>
        )}

        {tipo === 'hora' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Valor/hora (R$)</label>
              <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Horas estimadas</label>
              <input type="number" value={horas} onChange={e => setHoras(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
          </div>
        )}

        {tipo === 'hora' && totalHora !== null && (
          <div style={{ backgroundColor: '#1a1500', borderRadius: 8, padding: '8px 12px', marginBottom: 12, border: '1px solid #FFD11A22' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#FFD11A' }}>Total estimado: R$ {fmt(totalHora)}</p>
          </div>
        )}

        {tipo === 'visita' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Valor da visita (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>
        )}

        {/* Disponibilidade */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Disponibilidade</label>
          <input value={disponib} onChange={e => setDisponib(e.target.value)} placeholder="Ex: Amanhã, fins de semana, horário comercial..." style={inputStyle} />
        </div>

        {/* Diferenciais */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Diferenciais <span style={{ color: '#444', fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea value={diferenciais} onChange={e => setDiferenciais(e.target.value.slice(0, 300))} placeholder="O que te destaca dos outros?" rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, padding: '10px 12px' }} />
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#444', textAlign: 'right' }}>{diferenciais.length}/300</p>
        </div>

        {/* Mensagem */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mensagem *</label>
          <textarea value={mensagem} onChange={e => setMensagem(e.target.value.slice(0, 500))} placeholder="Apresente-se e explique como você pode ajudar..." rows={4} style={{ ...inputStyle, resize: 'none', lineHeight: 1.55, padding: '10px 12px' }} />
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#444', textAlign: 'right' }}>{mensagem.length}/500</p>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={!canSave || saving}
          style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', backgroundColor: canSave ? '#FFD11A' : '#1e1e1e', color: canSave ? '#0F0F0F' : '#555', fontSize: 15, fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {saving ? <><div style={{ width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Salvando...</> : 'Salvar alterações'}
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ─── Interest Card ──────────────────────────────────────── */
function InteresseCard({
  item,
  onEdit,
  onCancel,
  onOpenChat,
}: {
  item: Interesse
  onEdit: (item: Interesse) => void
  onCancel: (item: Interesse) => void
  onOpenChat: (chatId: string) => void
}) {
  const router = useRouter()
  const statusInfo = STATUS_INFO[item.status] ?? STATUS_INFO.pendente
  const msg = item.mensagem ?? item.proposta ?? ''
  const isPending   = item.status === 'pendente'
  const isAccepted  = item.status === 'aceita' || item.status === 'confirmada'
  const isRejected  = item.status === 'recusada'

  return (
    <div style={{ backgroundColor: '#171717', borderRadius: 16, padding: 16, marginBottom: 12, border: `1px solid ${isAccepted ? '#22C55E33' : isRejected ? '#333' : '#222'}`, opacity: isRejected ? 0.75 : 1 }}>

      {/* Top: title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/post/${item.post_id}`)}>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.post_title}
          </p>
          {item.post_city && (
            <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#555"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              {item.post_city}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: statusInfo.color, backgroundColor: statusInfo.bg, borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Contratante row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Avatar src={item.contratante_avatar} name={item.contratante_name} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.contratante_name || 'Contratante'}
            </span>
            {item.contratante_seal && (
              <span style={{ fontSize: 9, fontWeight: 800, color: SEAL_COLOR[item.contratante_seal], border: `1px solid ${SEAL_COLOR[item.contratante_seal]}44`, borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
                {SEAL_LABEL[item.contratante_seal]}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: '#444' }}>Enviado em {fmtDate(item.created_at)}</span>
        </div>
      </div>

      {/* Tipo + valor */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#777', backgroundColor: '#1e1e1e', borderRadius: 6, padding: '3px 8px' }}>
          {TIPO_LABEL[item.tipo ?? 'fixo'] ?? '💰 Valor fixo'}
        </span>
        <div style={{ textAlign: 'right' }}>
          {item.tipo === 'hora' ? (
            <>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#FFD11A' }}>R$ {fmt(item.valor ?? 0)}<span style={{ fontSize: 12 }}>/h</span></span>
              {item.horas_estimadas && (
                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#555' }}>
                  {item.horas_estimadas}h · total R$ {fmt((item.valor ?? 0) * item.horas_estimadas)}
                </p>
              )}
            </>
          ) : item.valor ? (
            <span style={{ fontSize: 18, fontWeight: 900, color: '#FFD11A' }}>R$ {fmt(item.valor)}</span>
          ) : (
            <span style={{ fontSize: 12, color: '#555' }}>a combinar</span>
          )}
        </div>
      </div>

      {/* Mensagem preview */}
      {msg.length > 0 && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          &ldquo;{msg}&rdquo;
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isPending && (
          <>
            <button onClick={() => onEdit(item)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #272727', backgroundColor: '#1e1e1e', color: '#ccc', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✏️ Editar
            </button>
            <button onClick={() => onCancel(item)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #2a1010', backgroundColor: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </>
        )}
        {isAccepted && (
          <button
            onClick={() => item.chat_id ? onOpenChat(item.chat_id) : router.push(`/post/${item.post_id}`)}
            style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {item.chat_id ? 'Abrir chat 💬' : 'Ver bico →'}
          </button>
        )}
        {isRejected && (
          <button onClick={() => router.push(`/post/${item.post_id}`)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #272727', backgroundColor: '#1e1e1e', color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver bico
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function MeusInteressesPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [items,       setItems]       = useState<Interesse[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<FilterKey>('todos')
  const [editItem,    setEditItem]    = useState<Interesse | null>(null)
  const [confirm,     setConfirm]     = useState<Interesse | null>(null)
  const userIdRef = useRef<string | null>(null)

  /* ── Load ── */
  const load = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return

    /* Candidaturas do usuário */
    const { data: cands } = await supabase
      .from('candidaturas')
      .select('id, status, tipo, valor, horas_estimadas, disponibilidade, diferenciais, proposta, mensagem, created_at, post_id, prestador_id')
      .eq('prestador_id', uid)
      .order('created_at', { ascending: false })

    if (!cands?.length) { setItems([]); setLoading(false); return }

    const postIds = [...new Set(cands.map(c => c.post_id))]

    /* Posts */
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, city, status, user_id')
      .in('id', postIds)

    const postMap = Object.fromEntries((posts ?? []).map(p => [p.id, p]))

    /* Contratante profiles */
    const contratanteIds = [...new Set((posts ?? []).map(p => p.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, seal')
      .in('id', contratanteIds)

    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    /* Chats para candidaturas aceitas */
    const chatMap: Record<string, string> = {}
    for (const table of ['chats', 'conversas']) {
      const { data: chats } = await supabase
        .from(table)
        .select('id, post_id')
        .in('post_id', postIds)
        .eq('prestador_id', uid)
      if (chats?.length) {
        for (const ch of chats) chatMap[ch.post_id] = ch.id
        break
      }
    }

    const enriched: Interesse[] = cands.map(c => {
      const post = postMap[c.post_id] ?? {}
      const prof = profMap[(post as { user_id: string }).user_id ?? ''] ?? {}
      return {
        id: c.id,
        status: c.status,
        tipo: c.tipo,
        valor: c.valor,
        horas_estimadas: c.horas_estimadas,
        disponibilidade: c.disponibilidade,
        diferenciais: c.diferenciais,
        proposta: c.proposta,
        mensagem: c.mensagem,
        created_at: c.created_at,
        post_id: c.post_id,
        post_title: (post as { title?: string }).title ?? 'Bico',
        post_city: (post as { city?: string }).city ?? null,
        post_status: (post as { status?: string }).status ?? 'aberto',
        contratante_id: (post as { user_id?: string }).user_id ?? '',
        contratante_name: (prof as { full_name?: string }).full_name ?? null,
        contratante_avatar: (prof as { avatar_url?: string }).avatar_url ?? null,
        contratante_seal: (prof as { seal?: string }).seal ?? null,
        chat_id: chatMap[c.post_id] ?? null,
      }
    })

    setItems(enriched)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      userIdRef.current = data.user.id
      load()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Cancel proposta ── */
  async function handleCancel(item: Interesse) {
    await supabase.from('candidaturas').update({ status: 'recusada' }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'recusada' } : i))
    setConfirm(null)
  }

  /* ── Counts ── */
  const counts: Record<string, number> = { todos: items.length, pendente: 0, aceita: 0, recusada: 0 }
  for (const i of items) {
    if (i.status === 'pendente') counts.pendente++
    else if (i.status === 'aceita' || i.status === 'confirmada') counts.aceita++
    else if (i.status === 'recusada') counts.recusada++
  }

  /* ── Filter ── */
  const filtered = filter === 'todos'
    ? items
    : items.filter(i => {
        const f = FILTER_LABELS.find(fl => fl.key === filter)
        return f ? f.statusMatch.includes(i.status) : true
      })

  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 32 }} />
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Meus Interesses</span>
        <div style={{ width: 32 }} />
      </div>

      {/* ─── Empty state ─── */}
      {items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '0 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 64 }}>🦆</div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#fff' }}>Você ainda não demonstrou interesse em nenhum bico</p>
            <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>Explore o feed e encontre bicos para você</p>
          </div>
          <button onClick={() => router.push('/feed')} style={{ height: 52, borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer', padding: '0 28px' }}>
            Explorar feed 🦆
          </button>
        </div>
      ) : (
        <>
          {/* ─── Filters ─── */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {FILTER_LABELS.map(f => {
              const count = counts[f.key] ?? 0
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{ flexShrink: 0, height: 32, borderRadius: 20, padding: '0 14px', border: `1px solid ${active ? '#FFD11A' : '#252525'}`, backgroundColor: active ? '#FFD11A' : 'transparent', color: active ? '#0F0F0F' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >
                  {f.label} ({count})
                </button>
              )
            })}
          </div>

          {/* ─── Empty filtered state ─── */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>🦆</p>
              <p style={{ fontSize: 14, color: '#555' }}>Nenhum interesse neste filtro</p>
            </div>
          ) : (
            <div style={{ padding: '4px 16px' }}>
              {filtered.map(item => (
                <InteresseCard
                  key={item.id}
                  item={item}
                  onEdit={setEditItem}
                  onCancel={i => setConfirm(i)}
                  onOpenChat={chatId => router.push(`/chat/${chatId}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Edit Modal ─── */}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={updated => {
            setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...updated } : i))
          }}
        />
      )}

      {/* ─── Cancel confirm ─── */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: 16, padding: '24px 20px', maxWidth: 320, width: '100%', border: '1px solid #2a2a2a' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#fff' }}>Cancelar proposta?</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888', lineHeight: 1.5 }}>
              Sua proposta para &ldquo;{confirm.post_title}&rdquo; será marcada como recusada. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid #2a2a2a', backgroundColor: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Voltar
              </button>
              <button onClick={() => handleCancel(confirm)} style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', backgroundColor: '#2a0d0d', color: '#f87171', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar proposta
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
