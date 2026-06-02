'use client'

import { useState, useCallback, useRef } from 'react'
import { createPublicClient } from '@/lib/supabase/public'

export interface SearchResult {
  id:           string
  name:         string
  initials:     string
  description:  string
  rating:       number
  ratingCount:  number
  city:         string
  distanceKm:   number
  jobsDone:     number
}

export interface UseSearchReturn {
  results:  SearchResult[]
  loading:  boolean
  error:    string | null
  searched: boolean
  search:   (query: string, cidade: string) => Promise<void>
  clear:    () => void
}

interface ProfileRow {
  id:                   string
  user_id:              string | null
  headline:             string | null
  skills:               string[] | null
  location_city:        string | null
  avg_rating:           number | null
  total_reviews:        number | null
  total_jobs_completed: number | null
}

const initialsOf = (n: string) =>
  n.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

/* ── Hook ──────────────────────────────────────────────────── */
export function useSearch(): UseSearchReturn {
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const supabaseRef = useRef(createPublicClient())
  const supabase    = supabaseRef.current

  const search = useCallback(async (query: string, cidade: string) => {
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setSearched(false)

    try {
      // Fetch available professionals, then match query against headline + skills.
      const { data, error: qErr } = await supabase
        .from('professional_profiles')
        .select('id, user_id, headline, skills, location_city, avg_rating, total_reviews, total_jobs_completed')
        .eq('is_available', true)
        .limit(50)

      if (qErr) throw qErr

      const profiles = (data ?? []) as unknown as ProfileRow[]
      const needle = q.toLowerCase()
      const matched = profiles.filter(p => {
        const hay = `${p.headline ?? ''} ${(p.skills ?? []).join(' ')}`.toLowerCase()
        return hay.includes(needle)
      })

      // Resolve display names
      const userIds = [...new Set(matched.map(p => p.user_id).filter(Boolean))] as string[]
      let nameMap: Record<string, string> = {}
      if (userIds.length) {
        const { data: us } = await supabase
          .from('users').select('id, full_name, username').in('id', userIds)
        if (us) {
          nameMap = Object.fromEntries(
            (us as { id: string; full_name: string | null; username: string }[])
              .map(u => [u.id, u.full_name || u.username]),
          )
        }
      }

      const mapped: SearchResult[] = matched.map(p => {
        const name = (p.user_id && nameMap[p.user_id]) || 'Profissional'
        return {
          id:          p.id,
          name,
          initials:    initialsOf(name),
          description: p.headline || (p.skills ?? []).join(', ') || 'Profissional disponível',
          rating:      Number(p.avg_rating) || 0,
          ratingCount: p.total_reviews ?? 0,
          city:        p.location_city || cidade || '',
          distanceKm:  0,
          jobsDone:    p.total_jobs_completed ?? 0,
        }
      })

      setResults(mapped)
      setSearched(true)
    } catch (e) {
      console.error('[useSearch] erro:', e)
      // On failure, behave as "no results" so the search still converts to a demand.
      setResults([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    setResults([])
    setSearched(false)
    setError(null)
  }, [])

  return { results, loading, error, searched, search, clear }
}
