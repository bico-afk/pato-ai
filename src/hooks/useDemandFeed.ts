'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { anonUsername } from '@/lib/anonymous'
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'

export interface DemandFeedItem {
  id:              string
  username:        string
  title:           string
  description:     string
  location_city:   string
  location_country:string
  candidate_count: number
  created_at:      string
  media_urls:      string[]
  user_id:         string | null
  anonymous_token: string | null
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
  const [error,      setError]      = useState<string | null>(null)
  const channelRef   = useRef<RealtimeChannel | null>(null)
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount   = useRef(0)
  // Stable ref — avoids re-creating supabase on every render (would cause infinite useEffect loop)
  const supabaseRef  = useRef(createPublicClient())
  const supabase     = supabaseRef.current

  function normalize(row: Record<string, unknown>, resolvedName?: string): DemandFeedItem {
    const usersObj = row.users as { username?: string } | null
    const anonTok  = row.anonymous_token as string | null
    const name     = resolvedName ?? usersObj?.username
    const username = name ? `@${name}` : anonTok ? anonUsername(anonTok) : '@usuário'
    return {
      id:               row.id as string,
      username,
      title:            (row.title as string | null) ?? '',
      description:      row.description as string,
      location_city:    (row.location_city as string | null) ?? '',
      location_country: (row.location_country as string | null) ?? 'BR',
      candidate_count:  (row.candidate_count as number | null) ?? 0,
      created_at:       row.created_at as string,
      media_urls:       (row.media_urls as string[] | null) ?? [],
      user_id:          (row.user_id as string | null) ?? null,
      anonymous_token:  (anonTok as string | null) ?? null,
    }
  }

  const reqIdRef = useRef(0)

  const fetchInitial = useCallback(async () => {
    const myReq = ++reqIdRef.current // only the latest fetch is allowed to write state
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

      if (myReq !== reqIdRef.current) return // superseded by a newer fetch — don't clobber

      if (error) {
        console.error('[useDemandFeed] erro:', error.code, error.message, error.hint)
        setError(`${error.code ?? 'erro'}: ${error.message ?? 'desconhecido'}`)
        return
      }

      setError(null)
      const rows = (data ?? []) as Record<string, unknown>[]

      // Enrich usernames for logged-in posters (anon posters use their token)
      const userIds = [...new Set(rows.map(r => r.user_id as string | null).filter(Boolean))] as string[]
      let nameMap: Record<string, string> = {}
      if (userIds.length) {
        try {
          const { data: us } = await withTimeout(
            supabase.from('user_public').select('id, username').in('id', userIds),
            8_000,
          ) as { data: { id: string; username: string }[] | null }
          if (us) nameMap = Object.fromEntries(us.map(u => [u.id, u.username]))
        } catch { /* non-fatal — fall back to generic name */ }
      }

      if (myReq !== reqIdRef.current) return // superseded
      setItems(rows.map(r => normalize(r, nameMap[r.user_id as string])))
    } catch (e) {
      console.error('[useDemandFeed] fetch falhou/timeout:', e)
      if (myReq === reqIdRef.current) setError(e instanceof Error ? `falha: ${e.message}` : 'falha desconhecida')
    } finally {
      if (myReq === reqIdRef.current) setLoading(false)
    }
  }, [opts.cityFilter, opts.stateFilter, opts.countryFilter, opts.keyword]) // supabase is stable via useRef

  // ── Fetch on mount + only when filters change (by value) ──
  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  // ── Realtime subscription: set up ONCE on mount, independent of refetches.
  //    (Previously this lived in the same effect as the fetch, so any refetch
  //     tore down and recreated the channel → online/offline + content flicker.)
  const MAX_REALTIME_RETRIES = 5

  useEffect(() => {
    let active = true

    // Unique channel name per mount avoids collisions (e.g. StrictMode double-mount).
    const channel = supabase
      .channel(`demands-feed-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'demands' },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!active) return
          const raw = payload.new as Record<string, unknown>
          let usersObj: { username?: string } | null = null
          const userId = raw.user_id as string | null
          if (userId) {
            try {
              const { data } = await supabase.from('user_public').select('username').eq('id', userId).single()
              usersObj = data ? { username: data.username as string } : null
            } catch { /* ignore */ }
          }
          if (!active) return
          const item: DemandFeedItem = { ...normalize({ ...raw, users: usersObj }), isNew: true }
          setItems(prev => {
            if (prev.some(i => i.id === item.id)) return prev
            const next = [item, ...prev].slice(0, MAX_ITEMS)
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
          if (!active) return
          const raw = payload.new as Record<string, unknown>
          setItems(prev => prev.map(i =>
            i.id === raw.id
              ? { ...i, candidate_count: (raw.candidate_count as number) ?? i.candidate_count }
              : i
          ))
        }
      )
      .subscribe((s: `${REALTIME_SUBSCRIBE_STATES}`) => {
        if (!active) return
        if (s === 'SUBSCRIBED') {
          setStatus('connected')
          retryCount.current = 0
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          // Reconnect a few times with growing backoff, then give up quietly.
          // (CLOSED is intentional teardown — never reconnect on it, to avoid
          //  the connect/disconnect flicker loop.)
          setStatus('disconnected')
          if (retryCount.current < MAX_REALTIME_RETRIES) {
            const delay = Math.min(2_000 * 2 ** retryCount.current, 30_000)
            retryCount.current++
            retryRef.current = setTimeout(() => { if (active) channel.subscribe() }, delay)
          }
        }
      })

    channelRef.current = channel

    return () => {
      active = false
      if (retryRef.current) clearTimeout(retryRef.current)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — mount once

  return { items, loading, status, error }
}
