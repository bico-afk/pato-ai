'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useDemandFeed } from '@/hooks/useDemandFeed'
import DemandCard from '@/components/demand/DemandCard'
import type { DemandFeedItem } from '@/hooks/useDemandFeed'
import { anonUsername } from '@/lib/anonymous'

type FilterKey = 'todos' | 'cidade' | 'estado' | 'brasil' | 'global'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos',  label: 'Todos'       },
  { key: 'cidade', label: 'Minha cidade' },
  { key: 'estado', label: 'Meu estado'   },
  { key: 'brasil', label: 'Brasil'       },
  { key: 'global', label: 'Global'       },
]

const PAGE_SIZE = 20
const REALTIME_COUNT = 20 // first page is served by the realtime hook (useDemandFeed)

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function FeedPage() {
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current

  const [filter,     setFilter]     = useState<FilterKey>('todos')
  const [keyword,    setKeyword]    = useState('')
  const [userCity,   setUserCity]   = useState('')
  const [userState,  setUserState]  = useState('')
  const [extraItems, setExtraItems] = useState<DemandFeedItem[]>([])
  const [loadingMore,setLoadingMore]= useState(false)
  const [hasMore,    setHasMore]    = useState(true)
  const [page,       setPage]       = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  const debouncedKeyword = useDebounce(keyword, 300)

  // Detect user location
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ?? ''
        if (!key) return
        const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&language=pt-BR&result_type=administrative_area_level_2&key=${key}`)
        const json = await res.json()
        const comps = json.results?.[0]?.address_components as Array<{ long_name: string; short_name: string; types: string[] }> | undefined
        const city  = comps?.find(c => c.types.includes('administrative_area_level_2'))?.long_name ?? ''
        const state = comps?.find(c => c.types.includes('administrative_area_level_1'))?.short_name ?? ''
        setUserCity(city)
        setUserState(state)
      } catch { /* ignore */ }
    }, () => {}, { timeout: 5000, maximumAge: 60_000 })
  }, [])

  // Build filter opts for realtime hook (first page) — memoized to keep object identity stable
  const feedOpts = useMemo(() => ({
    cityFilter:    filter === 'cidade' ? userCity    : undefined,
    stateFilter:   filter === 'estado' ? userState   : undefined,
    countryFilter: filter === 'brasil' ? 'BR'        : filter === 'global' ? undefined : undefined,
    keyword:       debouncedKeyword || undefined,
  }), [filter, userCity, userState, debouncedKeyword])

  const { items: realtimeItems, loading, status, error: feedError } = useDemandFeed(feedOpts)

  // Reset pagination when filter/keyword changes
  useEffect(() => {
    setExtraItems([])
    setPage(0)
    setHasMore(true)
  }, [filter, debouncedKeyword])

  // Load more for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    // Continue right after the realtime page (rows 0..19) — no gap.
    const offset = REALTIME_COUNT + page * PAGE_SIZE

    try {
      let query = supabase
        .from('demands')
        .select('id, description, location_city, location_country, candidate_count, created_at, media_urls, anonymous_token, user_id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filter === 'cidade' && userCity)  query = query.eq('location_city', userCity)
      if (filter === 'estado' && userState) query = query.eq('location_state', userState)
      if (filter === 'brasil')              query = query.eq('location_country', 'BR')
      if (debouncedKeyword) query = query.textSearch('description', debouncedKeyword, { type: 'plain', config: 'portuguese' })

      const { data } = await query
      if (!data || data.length < PAGE_SIZE) setHasMore(false)
      if (data && data.length > 0) {
        const rows = data as unknown as Record<string, unknown>[]

        // Enrich usernames for logged-in posters
        const userIds = [...new Set(rows.map(r => r.user_id as string | null).filter(Boolean))] as string[]
        let nameMap: Record<string, string> = {}
        if (userIds.length) {
          const { data: us } = await supabase.from('users').select('id, username').in('id', userIds)
          if (us) nameMap = Object.fromEntries((us as { id: string; username: string }[]).map(u => [u.id, u.username]))
        }

        const mapped: DemandFeedItem[] = rows.map(r => {
          const anonTok = r.anonymous_token as string | null
          const name    = nameMap[r.user_id as string]
          return {
            id:               r.id as string,
            username:         name ? `@${name}` : anonTok ? anonUsername(anonTok) : '@usuário',
            description:      r.description as string,
            location_city:    (r.location_city as string | null) ?? '',
            location_country: (r.location_country as string | null) ?? 'BR',
            candidate_count:  (r.candidate_count as number | null) ?? 0,
            created_at:       r.created_at as string,
            media_urls:       (r.media_urls as string[] | null) ?? [],
          }
        })
        setExtraItems(prev => [...prev, ...mapped])
        setPage(p => p + 1)
      }
    } catch (e) {
      console.error('[feed] loadMore falhou/timeout:', e)
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }, [page, loadingMore, hasMore, filter, userCity, userState, debouncedKeyword]) // supabase stable via useRef

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const allItems = [...realtimeItems, ...extraItems]

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Search */}
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="Buscar por serviço…"
          style={{
            width: '100%', height: 48, background: '#111',
            border: '1px solid #333', borderRadius: 10,
            color: '#fff', fontSize: 15, padding: '0 16px',
            outline: 'none', marginBottom: 16,
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
          onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                height: 34, padding: '0 14px', borderRadius: 99,
                border: `1px solid ${filter === f.key ? '#00d4ff' : '#222'}`,
                background: filter === f.key ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: filter === f.key ? '#00d4ff' : '#555',
                fontSize: 13, fontWeight: filter === f.key ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}

          {/* Live indicator */}
          <span style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700,
            color: status === 'connected' ? '#00d4ff' : '#444',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: status === 'connected' ? '#00d4ff' : '#333',
              animation: status === 'connected' ? 'live-pulse 2s ease-in-out infinite' : undefined,
            }} />
            {status === 'connected' ? 'ao vivo' : 'conectando'}
          </span>
        </div>

        {/* Cards — only show the spinner on the very first load (no items yet),
            so an eventual refetch never makes the list vanish/flicker. */}
        {loading && allItems.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <span style={{ width: 24, height: 24, border: '2px solid #222', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : allItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontSize: 15, color: '#555' }}>Nenhum pedido encontrado.</p>
            {feedError && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 10, fontFamily: 'monospace' }}>
                ⚠ {feedError}
              </p>
            )}
            <Link href="/nova-demanda" style={{ fontSize: 14, color: '#00d4ff', textDecoration: 'none', marginTop: 12, display: 'inline-block' }}>
              Seja o primeiro a publicar →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allItems.map(item => <DemandCard key={item.id} item={item} />)}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          {loadingMore && <span style={{ width: 20, height: 20, border: '2px solid #222', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
          {!hasMore && allItems.length > 0 && <p style={{ fontSize: 13, color: '#333' }}>Fim dos pedidos</p>}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse {
          0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
          50%      { opacity:0.7; box-shadow: 0 0 0 4px rgba(0,212,255,0); }
        }
        @keyframes demand-enter {
          from { opacity:0; transform: translateY(-8px); }
          to   { opacity:1; transform: translateY(0); }
        }
        input::placeholder { color: #444; }
      `}</style>
    </div>
  )
}
