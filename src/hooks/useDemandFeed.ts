'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { anonUsername } from '@/lib/anonymous'
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'

export interface DemandFeedItem {
  id:              string
  username:        string
  description:     string
  location_city:   string
  location_country:string
  candidate_count: number
  created_at:      string
  media_urls:      string[]
  isNew?:          boolean
}

const MAX_ITEMS = 20

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface UseDemandFeedOptions {
  cityFilter?:    string
  stateFilter?:   string
  countryFilter?: string
  keyword?:       string
}

export function useDemandFeed(opts: UseDemandFeedOptions = {}) {
  const [items,      setItems]      = useState<DemandFeedItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [status,     setStatus]     = useState<ConnectionStatus>('connecting')
  const channelRef   = useRef<RealtimeChannel | null>(null)
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount   = useRef(0)
  const supabase     = createClient()

  function normalize(row: Record<string, unknown>): DemandFeedItem {
    const usersObj = row.users as { username?: string } | null
    const anonTok  = row.anonymous_token as string | null
    const username = usersObj?.username ?? (anonTok ? `anon_${anonTok.substring(0, 6)}` : '@usuário')
    return {
      id:               row.id as string,
      username,
      description:      row.description as string,
      location_city:    (row.location_city as string | null) ?? '',
      location_country: (row.location_country as string | null) ?? 'BR',
      candidate_count:  (row.candidate_count as number | null) ?? 0,
      created_at:       row.created_at as string,
      media_urls:       (row.media_urls as string[] | null) ?? [],
    }
  }

  const fetchInitial = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('demands')
      .select('id, description, location_city, location_country, candidate_count, created_at, media_urls, anonymous_token, user_id, users(username)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS)

    if (opts.cityFilter)    query = query.eq('location_city', opts.cityFilter)
    if (opts.stateFilter)   query = query.eq('location_state', opts.stateFilter)
    if (opts.countryFilter) query = query.eq('location_country', opts.countryFilter)
    if (opts.keyword) {
      query = query.textSearch('description', opts.keyword, {
        type: 'plain',
        config: 'portuguese',
      })
    }

    const { data, error } = await query
    if (error) {
      console.error('[useDemandFeed] fetchInitial error:', error.code, error.message, error.details, error.hint)
      // Fallback: retry without join
      const { data: fallback, error: fallbackErr } = await supabase
        .from('demands')
        .select('id, description, location_city, location_country, candidate_count, created_at, media_urls, anonymous_token, user_id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS)
      if (fallbackErr) console.error('[useDemandFeed] fallback error:', fallbackErr.message)
      if (fallback) setItems((fallback as unknown as Record<string, unknown>[]).map(r => normalize(r)))
      setLoading(false)
      return
    }
    if (data) {
      setItems((data as unknown as Record<string, unknown>[]).map(r => normalize(r)))
    }
    setLoading(false)
  }, [opts.cityFilter, opts.stateFilter, opts.countryFilter, opts.keyword, supabase])

  function subscribe() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('demands-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'demands' },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const raw = payload.new as Record<string, unknown>
          // Fetch username separately if user_id present
          let usersObj: { username?: string } | null = null
          const userId = raw.user_id as string | null
          if (userId) {
            const { data } = await supabase
              .from('users').select('username').eq('id', userId).single()
            usersObj = data ? { username: data.username as string } : null
          }
          const item: DemandFeedItem = {
            ...normalize({ ...raw, users: usersObj }),
            isNew: true,
          }
          setItems(prev => {
            const next = [item, ...prev].slice(0, MAX_ITEMS)
            // Clear isNew after animation
            setTimeout(() => {
              setItems(cur => cur.map(i => i.id === item.id ? { ...i, isNew: false } : i))
            }, 400)
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'demands' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const raw = payload.new as Record<string, unknown>
          setItems(prev => prev.map(i =>
            i.id === raw.id
              ? { ...i, candidate_count: (raw.candidate_count as number) ?? i.candidate_count }
              : i
          ))
        }
      )
      .subscribe((s: `${REALTIME_SUBSCRIBE_STATES}`) => {
        if (s === 'SUBSCRIBED') {
          setStatus('connected')
          retryCount.current = 0
        } else if (s === 'CLOSED' || s === 'CHANNEL_ERROR') {
          setStatus('disconnected')
          // Exponential backoff reconnect
          const delay = Math.min(1000 * 2 ** retryCount.current, 30_000)
          retryCount.current++
          retryRef.current = setTimeout(subscribe, delay)
        }
      })

    channelRef.current = channel
  }

  useEffect(() => {
    fetchInitial()
    subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [fetchInitial]) // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, status }
}
