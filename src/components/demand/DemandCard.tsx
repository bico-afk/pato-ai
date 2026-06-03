'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getAnonToken } from '@/lib/anonymous'
import type { DemandFeedItem } from '@/hooks/useDemandFeed'

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 10)   return 'agora'
  if (diff < 60)   return `há ${diff}s`
  if (diff < 120)  return 'há 1 min'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 7200) return 'há 1 hora'
  return `há ${Math.floor(diff / 3600)} horas`
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="#ff4d7e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

interface Props {
  item: DemandFeedItem
}

export default function DemandCard({ item }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const [time, setTime] = useState(() => timeAgo(item.created_at))
  const [hover, setHover] = useState(false)

  // Dono do pedido? (resolvido no client p/ evitar mismatch de hidratação)
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    const ownedByAccount = !!(profile?.id && item.user_id && profile.id === item.user_id)
    const ownedByAnon    = !!(item.anonymous_token && item.anonymous_token === getAnonToken())
    setIsOwner(ownedByAccount || ownedByAnon)
  }, [profile, item.user_id, item.anonymous_token])

  useEffect(() => {
    const id = setInterval(() => setTime(timeAgo(item.created_at)), 15_000)
    return () => clearInterval(id)
  }, [item.created_at])

  const thumb = item.media_urls[0]

  return (
    <div
      onClick={() => router.push(`/pedido/${item.id}`)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#0f0f0f',
        border: `1px solid ${hover ? '#2a2a2a' : '#1e1e1e'}`,
        borderRadius: 12, padding: '16px 20px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.15s',
        animation: item.isNew ? 'demand-enter 0.3s ease-out both' : undefined,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.username}
        </span>
        <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>{time}</span>
      </div>

      {/* Description + optional thumbnail */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <p style={{
          fontSize: 15, color: '#fff', lineHeight: 1.55, margin: 0, flex: 1,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {item.description}
        </p>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
          <PinIcon />
          {item.location_city || 'Brasil'} · {item.location_country}
        </span>

        {item.candidate_count > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#fff',
            background: '#1a1a1a', border: '1px solid #333',
            borderRadius: 99, padding: '2px 8px', flexShrink: 0,
          }}>
            {item.candidate_count} candidato{item.candidate_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* "Tenho interesse" — só aparece se o pedido NÃO for meu */}
      {isOwner ? (
        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>📌 Este pedido é seu</span>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/pedido/${item.id}?interesse=1`) }}
          style={{
            marginTop: 2, height: 42, borderRadius: 9, border: 'none',
            background: '#00d4ff', color: '#001a20', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 7, transition: 'filter 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          ✋ Tenho interesse
        </button>
      )}
    </div>
  )
}
