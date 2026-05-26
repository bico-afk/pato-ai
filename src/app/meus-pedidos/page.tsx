'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Demand {
  id:              string
  description:     string
  location_city:   string | null
  location_country:string
  status:          string
  candidate_count: number
  created_at:      string
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)    return 'agora'
  if (m < 60)   return `${m}min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  if (m < 10080) return `${Math.floor(m / 1440)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function statusBadge(s: string): { label: string; color: string; bg: string } {
  switch (s) {
    case 'open':        return { label: 'Aberto',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   }
    case 'in_progress': return { label: 'Em andamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  }
    case 'closed':      return { label: 'Encerrado',    color: '#6b7280', bg: 'rgba(107,114,128,0.08)' }
    case 'cancelled':   return { label: 'Cancelado',    color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   }
    default:            return { label: s,              color: '#888',    bg: 'rgba(136,136,136,0.08)' }
  }
}

function Skeleton() {
  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ height: 13, width: '65%', borderRadius: 6, background: '#1a1a1a', marginBottom: 10 }} />
      <div style={{ height: 11, width: '40%', borderRadius: 6, background: '#161616' }} />
    </div>
  )
}

export default function MeusPedidosPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [demands,  setDemands]  = useState<Demand[]>([])
  const [loading,  setLoading]  = useState(true)
  const [noUser,   setNoUser]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth?next=/meus-pedidos'); return }

      // Get the users.id (pk) from auth_id
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()
      if (!userRow) { setNoUser(true); setLoading(false); return }

      const uid = (userRow as Record<string, unknown>).id as string

      const { data } = await supabase
        .from('demands')
        .select('id, description, location_city, location_country, status, candidate_count, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50)

      setDemands((data as unknown as Demand[] | null) ?? [])
      setLoading(false)
    }
    load()
  }, [supabase, router])

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 800, flex: 1, margin: 0 }}>Meus pedidos</h1>
        <Link href="/nova-demanda" style={{ height: 34, padding: '0 16px', borderRadius: 8, background: '#fff', color: '#000', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          + Novo
        </Link>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 64px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} />)}
          </div>
        )}

        {!loading && noUser && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Perfil não encontrado</p>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Faça login para ver seus pedidos</p>
            <button onClick={() => router.push('/auth')}
              style={{ height: 44, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontSize: 14 }}>
              Entrar
            </button>
          </div>
        )}

        {!loading && !noUser && demands.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📝</div>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhum pedido ainda</p>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 28, lineHeight: 1.6 }}>
              Publique o que você precisa — profissionais da sua região aparecem.
            </p>
            <Link href="/nova-demanda" style={{ height: 44, borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontWeight: 800, fontSize: 14, textDecoration: 'none', padding: '11px 28px' }}>
              Publicar pedido →
            </Link>
          </div>
        )}

        {!loading && demands.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {demands.map(d => {
              const badge = statusBadge(d.status)
              return (
                <div key={d.id} onClick={() => router.push(`/pedido/${d.id}`)}
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
                >
                  {/* Candidate badge */}
                  <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: d.candidate_count > 0 ? 'rgba(0,212,255,0.06)' : '#111', border: `1px solid ${d.candidate_count > 0 ? 'rgba(0,212,255,0.15)' : '#1e1e1e'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.candidate_count > 0 ? '#00d4ff' : '#333'} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    {d.candidate_count > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#00d4ff' }}>{d.candidate_count}</span>}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 0 6px' }}>
                      {d.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 99, padding: '2px 8px' }}>
                        {badge.label}
                      </span>
                      {d.location_city && <span style={{ fontSize: 11, color: '#444' }}>📍 {d.location_city}</span>}
                      <span style={{ fontSize: 11, color: '#333' }}>{timeAgo(d.created_at)}</span>
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
