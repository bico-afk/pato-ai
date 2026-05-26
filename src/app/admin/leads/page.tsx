'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'

/* ─── Types ─────────────────────────────────────────────── */
interface Lead {
  id: string
  nome: string | null
  telefone: string | null
  cidade: string | null
  categoria: string | null
  fonte: string | null
  site_url: string | null
  score_externo: number | null
  avaliacao_google: number | null
  total_reviews: number | null
  status: string | null
  contatado: boolean | null
  convertido: boolean | null
  created_at: string
}

type StatusFilter = 'todos' | 'novo' | 'contatado' | 'convertido'
type ScoreFilter  = 'todos' | 'top' | 'destaque' | 'estabelecido' | 'iniciante'

/* ─── Score label ─────────────────────────────────────── */
function scoreTier(score: number | null) {
  if (score == null) return { label: '—', color: '#555' }
  if (score >= 801) return { label: 'Top Bikco 🏆',    color: '#FFD11A' }
  if (score >= 601) return { label: 'Destaque ⭐',    color: '#60A5FA' }
  if (score >= 301) return { label: 'Estabelecido ✅', color: '#22c55e' }
  return                   { label: 'Iniciante 🔰',   color: '#9ca3af' }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* ─── CSV export ─────────────────────────────────────── */
function exportCsv(leads: Lead[]) {
  const header = ['Nome','Telefone','Cidade','Categoria','Score','Avaliação','Reviews','Site','Status','Contatado','Convertido','Criado']
  const rows = leads.map(l => [
    l.nome ?? '', l.telefone ?? '', l.cidade ?? '', l.categoria ?? '',
    l.score_externo ?? '', l.avaliacao_google ?? '', l.total_reviews ?? '',
    l.site_url ?? '', l.status ?? '', l.contatado ? 'Sim' : 'Não',
    l.convertido ? 'Sim' : 'Não', fmtDate(l.created_at),
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'leads-biko.csv'; a.click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════════════════════════════ */
export default function AdminLeadsPage() {
  const router = useRouter()
  const [authorized,   setAuthorized]   = useState(false)
  const [checking,     setChecking]     = useState(true)
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [loading,      setLoading]      = useState(true)
  const [page,         setPage]         = useState(0)
  const [hasMore,      setHasMore]      = useState(true)
  const [dbTotal,      setDbTotal]      = useState<number | null>(null)
  const PAGE_SIZE = 50
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [scoreFilter,  setScoreFilter]  = useState<ScoreFilter>('todos')
  const [cityFilter,   setCityFilter]   = useState('')
  const [catFilter,    setCatFilter]    = useState('')
  const [search,       setSearch]       = useState('')
  const [updating,     setUpdating]     = useState<string | null>(null)

  /* ── Verificação de admin (com Bearer token) ── */
  useEffect(() => {
    async function checkAdmin() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const headers: HeadersInit = session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {}
        const res = await fetch('/api/admin/check', { headers })
        if (!res.ok) { router.replace('/'); return }
        // 200 significa admin confirmado (API retorna 401 ou 403 nos outros casos)
        setAuthorized(true)
      } catch {
        router.replace('/')
      } finally {
        setChecking(false)
      }
    }
    checkAdmin()
  }, [router])

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const loadLeads = useCallback(async (pageNum = 0, append = false) => {
    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // Na primeira página, busca o total real em paralelo
    const pagePromise = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
    const countPromise = pageNum === 0
      ? supabase.from('leads').select('*', { count: 'exact', head: true })
      : Promise.resolve({ count: null })

    const [{ data }, { count }] = await Promise.all([pagePromise, countPromise])
    const rows = data ?? []
    setLeads(prev => append ? [...prev, ...rows] : rows)
    setHasMore(rows.length === PAGE_SIZE)
    if (count !== null) setDbTotal(count)
    setLoading(false)
  }, [supabase, PAGE_SIZE])

  useEffect(() => { loadLeads(0) }, [loadLeads])

  async function markContacted(id: string, val: boolean) {
    setUpdating(id)
    await supabase.from('leads').update({ contatado: val, status: val ? 'contatado' : 'novo' }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, contatado: val, status: val ? 'contatado' : 'novo' } : l))
    setUpdating(null)
  }

  async function markConverted(id: string, val: boolean) {
    setUpdating(id)
    await supabase.from('leads').update({ convertido: val, status: val ? 'convertido' : 'contatado' }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, convertido: val, status: val ? 'convertido' : 'contatado' } : l))
    setUpdating(null)
  }

  /* ── Filters ─── */
  const filtered = leads.filter(l => {
    if (statusFilter !== 'todos') {
      if (statusFilter === 'contatado' && !l.contatado) return false
      if (statusFilter === 'convertido' && !l.convertido) return false
      if (statusFilter === 'novo' && (l.contatado || l.convertido)) return false
    }
    if (scoreFilter !== 'todos') {
      const s = l.score_externo ?? 0
      if (scoreFilter === 'top'         && s < 801) return false
      if (scoreFilter === 'destaque'    && (s < 601 || s >= 801)) return false
      if (scoreFilter === 'estabelecido'&& (s < 301 || s >= 601)) return false
      if (scoreFilter === 'iniciante'   && s >= 301) return false
    }
    if (cityFilter && !(l.cidade ?? '').toLowerCase().includes(cityFilter.toLowerCase())) return false
    if (catFilter  && !(l.categoria ?? '').toLowerCase().includes(catFilter.toLowerCase())) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(l.nome ?? '').toLowerCase().includes(q) && !(l.telefone ?? '').includes(q)) return false
    }
    return true
  })

  /* ── Guard de renderização ── */
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  if (!authorized) return null

  /* ── Stats ── */
  const total     = dbTotal ?? leads.length   // total real do banco; fallback para carregados
  const novos     = leads.filter(l => !l.contatado && !l.convertido).length
  const contatados = leads.filter(l => l.contatado && !l.convertido).length
  const convertidos = leads.filter(l => l.convertido).length

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>🦆 Admin — Leads</h1>
            <p style={{ fontSize: 13, color: '#555', margin: 0 }}>Negócios captados via busca Google</p>
          </div>
          <button
            onClick={() => exportCsv(filtered)}
            style={{
              height: 38, borderRadius: 99, border: '1px solid #2E2E2E',
              background: '#1A1A1A', color: '#aaa', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ↓ CSV
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total', value: total,      color: '#fff'     },
            { label: 'Novos', value: novos,      color: '#FFD11A'  },
            { label: 'Contatados', value: contatados, color: '#60A5FA' },
            { label: 'Convertidos', value: convertidos, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#141414', border: '1px solid #1E1E1E', borderRadius: 14,
              padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: '#141414', border: '1px solid #1E1E1E', borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

            {/* Search */}
            <input
              placeholder="🔍 Nome ou telefone"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: '1 1 160px', height: 36, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#fff', fontSize: 13, padding: '0 14px', outline: 'none',
              }}
            />

            {/* City */}
            <input
              placeholder="🏙️ Cidade"
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              style={{
                flex: '1 1 120px', height: 36, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#fff', fontSize: 13, padding: '0 14px', outline: 'none',
              }}
            />

            {/* Category */}
            <input
              placeholder="🔧 Categoria"
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              style={{
                flex: '1 1 120px', height: 36, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#fff', fontSize: 13, padding: '0 14px', outline: 'none',
              }}
            />

            {/* Status */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                flex: '1 1 130px', height: 36, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#aaa', fontSize: 13, padding: '0 14px', outline: 'none',
              }}
            >
              <option value="todos">Status: Todos</option>
              <option value="novo">Novos</option>
              <option value="contatado">Contatados</option>
              <option value="convertido">Convertidos</option>
            </select>

            {/* Score tier */}
            <select
              value={scoreFilter}
              onChange={e => setScoreFilter(e.target.value as ScoreFilter)}
              style={{
                flex: '1 1 150px', height: 36, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#aaa', fontSize: 13, padding: '0 14px', outline: 'none',
              }}
            >
              <option value="todos">Score: Todos</option>
              <option value="top">Top Bikco (801+)</option>
              <option value="destaque">Destaque (601-800)</option>
              <option value="estabelecido">Estabelecido (301-600)</option>
              <option value="iniciante">Iniciante (0-300)</option>
            </select>
          </div>

          <p style={{ fontSize: 12, color: '#555', margin: '10px 0 0' }}>
            Mostrando <span style={{ color: '#FFD11A', fontWeight: 700 }}>{filtered.length}</span> de {total} leads
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, margin: '0 auto 12px', border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#555' }}>Carregando leads...</p>
          </div>
        )}

        {/* Table (mobile-friendly cards) */}
        {!loading && filtered.map(l => {
          const tier = scoreTier(l.score_externo)
          return (
            <div
              key={l.id}
              style={{
                background: '#141414', border: '1px solid #1E1E1E', borderRadius: 14,
                padding: 14, marginBottom: 10,
              }}
            >
              {/* Row 1: name + status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{l.nome ?? 'Sem nome'}</span>
                  {l.categoria && <span style={{ marginLeft: 8, fontSize: 11, color: '#666' }}>{l.categoria}</span>}
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {l.convertido && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 99, padding: '2px 8px' }}>Convertido</span>
                  )}
                  {!l.convertido && l.contatado && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 99, padding: '2px 8px' }}>Contatado</span>
                  )}
                  {!l.contatado && !l.convertido && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,209,26,0.1)', color: '#FFD11A', border: '1px solid rgba(255,209,26,0.25)', borderRadius: 99, padding: '2px 8px' }}>Novo</span>
                  )}
                </div>
              </div>

              {/* Row 2: details */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 12, color: '#666' }}>
                {l.telefone && <span>📞 {l.telefone}</span>}
                {l.cidade   && <span>📍 {l.cidade}</span>}
                {l.avaliacao_google != null && <span>⭐ {l.avaliacao_google.toFixed(1)} ({l.total_reviews ?? 0})</span>}
                {l.score_externo != null && <span style={{ color: tier.color, fontWeight: 700 }}>Score {l.score_externo} · {tier.label}</span>}
                {l.site_url && <a href={l.site_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'none' }}>🌐 Site</a>}
                <span style={{ marginLeft: 'auto', color: '#444' }}>{fmtDate(l.created_at)}</span>
              </div>

              {/* Row 3: actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {l.telefone && (
                  <a
                    href={`tel:${l.telefone}`}
                    style={{
                      height: 32, borderRadius: 99, border: 'none',
                      background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', padding: '0 14px', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    📞 Ligar
                  </a>
                )}
                {l.telefone && (
                  <a
                    href={`https://wa.me/55${l.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá${l.nome ? `, ${l.nome}` : ''}! Vi seu negócio na Bikco e gostaria de conversar.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      height: 32, borderRadius: 99, border: 'none',
                      background: '#25D366', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', padding: '0 14px', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    WA
                  </a>
                )}
                <button
                  onClick={() => markContacted(l.id, !l.contatado)}
                  disabled={updating === l.id}
                  style={{
                    height: 32, borderRadius: 99,
                    border: `1px solid ${l.contatado ? 'rgba(96,165,250,0.4)' : '#2E2E2E'}`,
                    background: l.contatado ? 'rgba(96,165,250,0.1)' : '#1A1A1A',
                    color: l.contatado ? '#60A5FA' : '#888',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px',
                  }}
                >
                  {l.contatado ? '✓ Contatado' : 'Marcar contatado'}
                </button>
                <button
                  onClick={() => markConverted(l.id, !l.convertido)}
                  disabled={updating === l.id}
                  style={{
                    height: 32, borderRadius: 99,
                    border: `1px solid ${l.convertido ? 'rgba(34,197,94,0.4)' : '#2E2E2E'}`,
                    background: l.convertido ? 'rgba(34,197,94,0.1)' : '#1A1A1A',
                    color: l.convertido ? '#22c55e' : '#888',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px',
                  }}
                >
                  {l.convertido ? '✓ Convertido' : 'Marcar convertido'}
                </button>
              </div>
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 15, color: '#555' }}>Nenhum lead com esses filtros</p>
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => {
                const nextPage = page + 1
                setPage(nextPage)
                loadLeads(nextPage, true)
              }}
              style={{
                height: 40, borderRadius: 99, border: '1px solid #2E2E2E',
                background: '#1A1A1A', color: '#aaa', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', padding: '0 28px',
              }}
            >
              Carregar mais
            </button>
          </div>
        )}

        {loading && page > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 24, height: 24, margin: '0 auto', border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, select { color: #444; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
