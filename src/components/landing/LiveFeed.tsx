'use client'

import { useRef, useEffect, useState } from 'react'
import { useLiveFeed, type FeedItem } from '@/hooks/useLiveFeed'

/* ── Time display ────────────────────────────────────────── */
function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 10)  return 'agora'
  if (diff < 60)  return `há ${diff}s`
  if (diff < 120) return 'há 1 min'
  return `há ${Math.floor(diff / 60)} min`
}

/* ── Feed card ───────────────────────────────────────────── */
function FeedCard({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const [time, setTime] = useState(() => timeAgo(item.createdAt))

  useEffect(() => {
    const id = setInterval(() => setTime(timeAgo(item.createdAt)), 10_000)
    return () => clearInterval(id)
  }, [item.createdAt])

  return (
    <div
      style={{
        background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 10,
        padding: '14px 16px',
        animation: isNew ? 'slide-in 0.35s ease both' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Live dot */}
          <span style={{
            flexShrink: 0, width: 7, height: 7, borderRadius: '50%',
            background: '#00d4ff', boxShadow: '0 0 6px #00d4ff88',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.username}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Candidate badge */}
          {item.candidateCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#00d4ff',
              background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: 99, padding: '1px 7px',
            }}>
              {item.candidateCount} candidato{item.candidateCount !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#334155' }}>{time}</span>
        </div>
      </div>

      <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 8px 0',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
        {item.description}
      </p>

      <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
        📍 {item.city} · {item.country}
      </p>
    </div>
  )
}

/* ── LiveFeed ─────────────────────────────────────────────── */
export default function LiveFeed() {
  const items = useLiveFeed()
  const prevCount = useRef(items.length)
  const [newId, setNewId] = useState<string | null>(null)

  useEffect(() => {
    if (items.length > 0 && prevCount.current < items.length) {
      setNewId(items[0].id)
      const id = setTimeout(() => setNewId(null), 400)
      return () => clearTimeout(id)
    }
    prevCount.current = items.length
  }, [items])

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff' }}>
          Pedidos chegando agora
        </h2>
        {/* Pulsing live indicator */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700, color: '#00d4ff',
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 99, padding: '3px 9px',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4ff',
            display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
          ao vivo
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <FeedCard key={item.id} item={item} isNew={item.id === newId} />
        ))}
      </div>

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 4px rgba(0,212,255,0); }
        }
      `}</style>
    </section>
  )
}
