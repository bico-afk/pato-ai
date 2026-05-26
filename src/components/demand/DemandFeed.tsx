'use client'

import DemandCard from './DemandCard'
import { useDemandFeed } from '@/hooks/useDemandFeed'

interface Props {
  cityFilter?:    string
  stateFilter?:   string
  countryFilter?: string
  keyword?:       string
  title?:         string
}

/* ── Skeleton card ──────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 12, width: 120, borderRadius: 4, background: '#1a1a1a' }} />
        <div style={{ height: 12, width: 50,  borderRadius: 4, background: '#161616' }} />
      </div>
      <div style={{ height: 14, width: '85%', borderRadius: 4, background: '#181818' }} />
      <div style={{ height: 14, width: '60%', borderRadius: 4, background: '#161616' }} />
      <div style={{ height: 12, width: 100,   borderRadius: 4, background: '#1a1a1a' }} />
    </div>
  )
}

export default function DemandFeed({ cityFilter, stateFilter, countryFilter, keyword, title }: Props) {
  const { items, loading, status } = useDemandFeed({ cityFilter, stateFilter, countryFilter, keyword })

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff', margin: 0 }}>
          {title ?? 'Pedidos em aberto'}
        </h2>

        {/* Live badge */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700,
          color: status === 'connected' ? '#00d4ff' : '#555',
          background: status === 'connected' ? 'rgba(0,212,255,0.08)' : '#111',
          border: `1px solid ${status === 'connected' ? 'rgba(0,212,255,0.2)' : '#222'}`,
          borderRadius: 99, padding: '3px 9px',
          transition: 'all 0.4s',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: status === 'connected' ? '#00d4ff' : '#444',
            display: 'inline-block',
            animation: status === 'connected' ? 'live-pulse 2s ease-in-out infinite' : undefined,
          }} />
          {status === 'connected' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'offline'}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading
          ? [1, 2, 3].map(i => <SkeletonCard key={i} />)
          : items.length === 0
          ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12,
            }}>
              <p style={{ fontSize: 15, color: '#555' }}>
                Nenhum pedido aberto no momento.
              </p>
            </div>
          )
          : items.map(item => <DemandCard key={item.id} item={item} />)
        }
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 4px rgba(0,212,255,0); }
        }
        @keyframes demand-enter {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
