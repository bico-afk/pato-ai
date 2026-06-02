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

/** Rejects if the promise/thenable doesn't settle within `ms`. */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

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
  // Stable ref — avoids re-creating supabase on every render (would cause infinite useEffect loop)
  const supabaseRef  = useRef(createClient())
  const supabase     = supabaseRef.current

  function normalize(row: Record<string, unknown>, resolvedName?: string): DemandFeedItem {
    const usersObj = row.users as { username?: string } | null
    const anonTok  = row.anonymous_token as string | null
    const name     = resolvedName ?? usersObj?.username
    const username = name ? `@${name}` : anonTok ? anonUsername(anonTok) : '@usuário'
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
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('demands')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(MAX_ITEMS),
        12_000,
      ) as { data: Record<string, unknown>[] | null; error: { code?: string; message?: string; hint?: string } | null }

      if (error) {
        console.error('[useDemandFeed] erro:', error.code, error.message, error.hint)
        return
      }

      const rows = (data ?? []) as Record<string, unknown>[]

      // Enrich usernames for logged-in posters (anon posters use their token)
      const userIds = [...new Set(rows.map(r => r.user_id as string | null).filter(Boolean))] as string[]
      let nameMap: Record<string, string> = {}
      if (userIds.length) {
        try {
          const { data: us } = await withTimeout(
            supabase.from('users').select('id, username').in('id', userIds),
            8_000,
          ) as { data: { id: string; username: string }[] | null }
          if (us) nameMap = Object.fromEntries(us.map(u => [u.id, u.username]))
        } catch { /* non-fatal — fall back to generic name */ }
      }

      setItems(rows.map(r => normalize(r, nameMap[r.user_id as string])))
    } catch (e) {
      console.error('[useDemandFeed] fetch falhou/timeout:', e)
    } finally {
      setLoading(false)
    }
  }, [opts.cityFilter, opts.stateFilter, opts.countryFilter, opts.keyword]) // supabase is stable via useRef

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
