'use client'

import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Post {
  id: string
  title: string
  description: string | null
  category: string | null
  city: string | null
  urgency: string | null
  budget: number | null
  status: string
  created_at: string
  user_id: string
  latitude: number
  longitude: number
  photo_url: string | null
  author_name: string | null
  author_avatar: string | null
  author_concluidos: number | null
}

/* ─── Constants ──────────────────────────────────────────── */
const CATEGORY_ICONS: Record<string, string> = {
  'Elétrica': '⚡', 'Encanamento': '🔧', 'Limpeza': '🧹',
  'Reformas': '🏗️', 'Pintura': '🎨', 'Montagem': '📦',
  'Mudança': '🚚', 'Jardim': '🌿', 'Informática': '💻',
  'Aulas': '📚', 'Beleza': '✂️', 'Pets': '🐾',
  'Design': '🖌️', 'Culinária': '🍳', 'Outros': '🔨',
}

const FILTER_CHIPS = [
  { key: 'todos', label: 'Todos' },
  { key: 'urgentes', label: '🔥 Urgentes' },
  { key: 'Elétrica', label: '⚡ Elétrica' },
  { key: 'Limpeza', label: '🧹 Limpeza' },
  { key: 'Reformas', label: '🏗️ Reformas' },
  { key: 'Pintura', label: '🎨 Pintura' },
  { key: 'Encanamento', label: '🔧 Encanamento' },
  { key: 'Informática', label: '💻 Informática' },
  { key: 'Jardim', label: '🌿 Jardim' },
  { key: 'Limpeza', label: '🧹 Limpeza' },
  { key: 'Pets', label: '🐾 Pets' },
]

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333] // São Paulo

/* ─── Helpers ────────────────────────────────────────────── */
function getCategoryIcon(cat: string | null): string {
  if (!cat) return '📍'
  return CATEGORY_ICONS[cat] ?? '📍'
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getSeal(n: number | null): string {
  if (!n || n < 1) return ''
  if (n >= 51) return ' 🥇'
  if (n >= 11) return ' 🥈'
  return ' 🥉'
}

function createMarkerIcon(post: Post, userId: string | null): L.DivIcon {
  const isOwn = post.user_id === userId
  const isUrgent = post.urgency === 'hoje'
  const color = isOwn ? '#FF7A1A' : isUrgent ? '#FF4444' : '#FFD11A'
  const icon = getCategoryIcon(post.category)
  const anim = isUrgent && !isOwn ? 'animation:pinPulse 1.5s ease-in-out infinite;' : ''
  const shadow = isOwn ? '0 0 0 3px rgba(255,122,26,0.4)' : isUrgent ? '0 0 0 3px rgba(255,68,68,0.4)' : '0 2px 10px rgba(0,0,0,0.5)'

  return L.divIcon({
    className: '',
    html: `<div style="
      width:38px;height:38px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
      box-shadow:${shadow};
      border:2px solid rgba(255,255,255,0.2);
      ${anim}
    ">${icon}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  })
}

function createClusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count > 99 ? 52 : count > 9 ? 46 : 40
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#FFD11A;color:#0F0F0F;
      display:flex;align-items:center;justify-content:center;
      font-size:${count > 99 ? 12 : 14}px;font-weight:700;
      font-family:Inter,sans-serif;
      box-shadow:0 3px 12px rgba(0,0,0,0.5);
      border:3px solid rgba(255,255,255,0.25);
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/* ─── Map sub-components ─────────────────────────────────── */
function BoundsWatcher({
  onBoundsChange,
}: {
  onBoundsChange: (b: L.LatLngBounds) => void
}) {
  const map = useMap()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onBoundsChange(map.getBounds()), 350)
  }, [map, onBoundsChange])

  // Fire on first mount (initial load)
  useEffect(() => {
    fire()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMapEvents({ moveend: fire, zoomend: fire })
  return null
}

function FlyToLocation({ target }: { target: [number, number] | null }) {
  const map = useMap()
  const prevRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    if (!target) return
    if (prevRef.current?.[0] === target[0] && prevRef.current?.[1] === target[1]) return
    prevRef.current = target
    map.flyTo(target, 14, { duration: 1 })
  }, [target, map])
  return null
}

/* ─── Main component ─────────────────────────────────────── */
export default function MapClient() {
  const router = useRouter()
  const supabase = createClient()

  const [posts, setPosts] = useState<Post[]>([])
  const [selected, setSelected] = useState<Post | null>(null)
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(0)
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null)

  const filterRef = useRef(filter)
  const queryRef = useRef(query)
  filterRef.current = filter
  queryRef.current = query

  /* ── init: auth + geolocation ── */
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
          () => { /* use default center */ }
        )
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── load posts by bounds ── */
  const loadPosts = useCallback(async (
    bounds: L.LatLngBounds,
    f: string,
    q: string,
  ) => {
    let qb = supabase
      .from('posts')
      .select('id,title,description,category,city,urgency,budget,status,created_at,user_id,latitude,longitude,photo_url')
      .eq('status', 'aberto')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', bounds.getSouth())
      .lte('latitude', bounds.getNorth())
      .gte('longitude', bounds.getWest())
      .lte('longitude', bounds.getEast())
      .limit(150)

    if (f === 'urgentes') qb = qb.eq('urgency', 'hoje')
    else if (f !== 'todos') qb = qb.ilike('category', `%${f}%`)
    if (q) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

    const { data } = await qb
    if (!data) return

    // Enrich with author info
    const uids = [...new Set((data as Record<string, unknown>[]).map(p => p.user_id as string))]
    const { data: profs } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,concluidos')
      .in('id', uids)

    type ProfRow = { id: string; full_name: string | null; avatar_url: string | null; concluidos: number | null }
    const pm: Record<string, ProfRow> = {}
    for (const p of (profs ?? []) as ProfRow[]) pm[p.id] = p

    const enriched: Post[] = (data as Record<string, unknown>[]).map(p => ({
      id: p.id as string,
      title: p.title as string,
      description: p.description as string | null,
      category: p.category as string | null,
      city: p.city as string | null,
      urgency: p.urgency as string | null,
      budget: p.budget as number | null,
      status: p.status as string,
      created_at: p.created_at as string,
      user_id: p.user_id as string,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      photo_url: p.photo_url as string | null,
      author_name: pm[p.user_id as string]?.full_name ?? null,
      author_avatar: pm[p.user_id as string]?.avatar_url ?? null,
      author_concluidos: pm[p.user_id as string]?.concluidos ?? null,
    }))

    setPosts(enriched)
    setVisibleCount(enriched.length)
  }, [supabase])

  /* ── realtime: new posts appear on map ── */
  useEffect(() => {
    const channel = supabase
      .channel('mapa-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const p = payload.new as Record<string, unknown>
        if (!p.latitude || !p.longitude || p.status !== 'aberto') return
        if (!mapBounds?.contains([p.latitude as number, p.longitude as number])) return

        // Apply current filter
        const f = filterRef.current
        const q = queryRef.current
        if (f === 'urgentes' && p.urgency !== 'hoje') return
        if (f !== 'todos' && f !== 'urgentes') {
          const cat = (p.category as string ?? '').toLowerCase()
          if (!cat.includes(f.toLowerCase())) return
        }
        if (q) {
          const title = (p.title as string ?? '').toLowerCase()
          const desc = (p.description as string ?? '').toLowerCase()
          if (!title.includes(q.toLowerCase()) && !desc.includes(q.toLowerCase())) return
        }

        setPosts(prev => [...prev, {
          id: p.id as string,
          title: p.title as string,
          description: p.description as string | null,
          category: p.category as string | null,
          city: p.city as string | null,
          urgency: p.urgency as string | null,
          budget: p.budget as number | null,
          status: p.status as string,
          created_at: p.created_at as string,
          user_id: p.user_id as string,
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          photo_url: p.photo_url as string | null,
          author_name: null,
          author_avatar: null,
          author_concluidos: null,
        }])
        setVisibleCount(c => c + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, mapBounds])

  /* ── bounds handler ── */
  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds)
    loadPosts(bounds, filterRef.current, queryRef.current)
  }, [loadPosts])

  /* ── re-search when filter/query changes ── */
  useEffect(() => {
    if (!mapBounds) return
    loadPosts(mapBounds, filter, query)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query])

  /* ── locate me ── */
  function locateMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setUserLocation([pos.coords.latitude, pos.coords.longitude])
    })
  }

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100dvh',
      overflow: 'hidden',
      background: '#1a1a2e',
    }}>
      {/* Global CSS for pulse animation */}
      <style>{`
        @keyframes pinPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,68,68,0.5); }
          50% { transform: scale(1.18); box-shadow: 0 0 0 10px rgba(255,68,68,0); }
        }
        .leaflet-container { background: #1a1a2e !important; }
        .leaflet-control-attribution { display: none !important; }
        .marker-cluster-custom { background: transparent !important; border: none !important; }
      `}</style>

      {/* ── MAP ── */}
      <MapContainer
        center={userLocation ?? DEFAULT_CENTER}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="© CartoDB"
          subdomains="abcd"
          maxZoom={20}
        />

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon as any}
          chunkedLoading
          maxClusterRadius={60}
          animate
        >
          {posts.map(p => (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={createMarkerIcon(p, userId)}
              eventHandlers={{ click: () => setSelected(p) }}
            />
          ))}
        </MarkerClusterGroup>

        <BoundsWatcher onBoundsChange={handleBoundsChange} />
        <FlyToLocation target={userLocation} />
      </MapContainer>

      {/* ── FLOATING HEADER ── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '16px 16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 480,
        margin: '0 auto',
      }}>
        {/* Search bar */}
        <div style={{
          background: 'rgba(14,14,14,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          height: 52,
          padding: '0 14px',
          gap: 10,
        }}>
          <span style={{ fontSize: 18, color: '#555' }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar na área do mapa..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', color: '#555',
              cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: 4,
        }}>
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.key + chip.label}
              onClick={() => setFilter(chip.key)}
              style={{
                flexShrink: 0,
                background: filter === chip.key ? '#FFD11A' : 'rgba(14,14,14,0.88)',
                color: filter === chip.key ? '#0F0F0F' : '#ddd',
                border: filter === chip.key ? 'none' : '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 20,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: filter === chip.key ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── COUNTER ── */}
      <div style={{
        position: 'absolute',
        top: 140,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        background: 'rgba(14,14,14,0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '6px 16px',
        fontSize: 13,
        color: visibleCount > 0 ? '#FFD11A' : '#666',
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {visibleCount === 0
          ? 'Nenhum bico na área'
          : `${visibleCount} bico${visibleCount !== 1 ? 's' : ''} nesta área`}
      </div>

      {/* ── LOCATION BUTTON ── */}
      <button
        onClick={locateMe}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 96,
          zIndex: 1000,
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: 'rgba(14,14,14,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
        title="Minha localização"
      >
        📍
      </button>

      {/* ── BOTTOM SHEET: SELECTED POST ── */}
      {selected && (
        <>
          {/* Overlay to close */}
          <div
            onClick={() => setSelected(null)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1001,
            }}
          />

          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1002,
            background: '#141414',
            borderRadius: '22px 22px 0 0',
            padding: '0 16px 32px',
            boxShadow: '0 -6px 40px rgba(0,0,0,0.7)',
            maxHeight: '65dvh',
            overflowY: 'auto',
            maxWidth: 480,
            margin: '0 auto',
          }}>
            {/* Handle */}
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: '#333',
              margin: '14px auto 16px',
            }} />

            {/* Author row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#1E1E1E', overflow: 'hidden', flexShrink: 0,
              }}>
                {selected.author_avatar
                  ? <img src={selected.author_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🦆</div>
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
                  {selected.author_name ?? 'Usuário'}{getSeal(selected.author_concluidos)}
                </div>
                {selected.city && (
                  <div style={{ fontSize: 12, color: '#666' }}>📍 {selected.city}</div>
                )}
              </div>
            </div>

            {/* Title */}
            <div style={{
              fontWeight: 700, fontSize: 19, color: '#fff',
              lineHeight: 1.3, marginBottom: 12,
            }}>
              {selected.title}
            </div>

            {/* Badges */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14,
            }}>
              {selected.category && (
                <span style={{
                  background: '#1E1E1E', borderRadius: 8, padding: '5px 11px',
                  fontSize: 13, color: '#ccc',
                }}>
                  {getCategoryIcon(selected.category)} {selected.category}
                </span>
              )}
              {selected.urgency === 'hoje' && (
                <span style={{
                  background: 'rgba(255,68,68,0.12)', color: '#FF4444',
                  borderRadius: 8, padding: '5px 11px', fontSize: 13, fontWeight: 700,
                }}>
                  🔥 Urgente
                </span>
              )}
              {selected.budget != null && (
                <span style={{
                  background: 'rgba(255,209,26,0.12)', color: '#FFD11A',
                  borderRadius: 8, padding: '5px 11px', fontSize: 13, fontWeight: 700,
                }}>
                  R$ {selected.budget.toLocaleString('pt-BR')}
                </span>
              )}
              {userLocation && (
                <span style={{
                  background: '#1E1E1E', borderRadius: 8, padding: '5px 11px',
                  fontSize: 13, color: '#888',
                }}>
                  🛣️ {haversine(userLocation[0], userLocation[1], selected.latitude, selected.longitude).toFixed(1)} km
                </span>
              )}
            </div>

            {/* Description preview */}
            {selected.description && (
              <div style={{
                fontSize: 14, color: '#777', lineHeight: 1.6, marginBottom: 18,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}>
                {selected.description}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => router.push(`/bico/${selected.id}`)}
                style={{
                  flex: 1, background: '#FFD11A', border: 'none', borderRadius: 14,
                  padding: '14px 10px', color: '#0F0F0F', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Ver post completo →
              </button>
              <button
                onClick={() => router.push(`/enviar-proposta/${selected.id}`)}
                style={{
                  flex: 1, background: '#1E1E1E', border: '1px solid #2A2A2A',
                  borderRadius: 14, padding: '14px 10px', color: '#FFD11A',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Tenho interesse 🦆
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid #1E1E1E',
        display: 'flex',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        {[
          { icon: '🏠', label: 'Feed', href: '/feed' },
          { icon: '🔍', label: 'Buscar', href: '/busca' },
          { icon: '+', label: '', href: '/criar-post', big: true },
          { icon: '🔖', label: 'Salvos', href: '/salvos' },
          { icon: '👤', label: 'Perfil', href: '/perfil' },
        ].map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              flex: 1, background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, cursor: 'pointer',
              padding: item.big ? 0 : '6px 0',
            }}
          >
            {item.big ? (
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#FFD11A', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28, fontWeight: 900,
                color: '#0F0F0F', marginTop: -10,
                lineHeight: 1,
              }}>+</div>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 10, color: '#666', fontFamily: 'Inter, sans-serif' }}>
                  {item.label}
                </span>
              </>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
