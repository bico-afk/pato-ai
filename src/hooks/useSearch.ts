'use client'

import { useState, useCallback } from 'react'

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

/**
 * Landing-page CTA hook.
 *
 * In Bikco the bar PUBLISHES a request — it does NOT search or match against
 * existing professionals. So `search()` just flags the query as submitted; the
 * actual demand insert happens in <SearchResults> (which publishes whenever
 * there are no professional results — and here there never are).
 *
 * `results` is always empty; it's kept only to preserve the component API.
 */
export function useSearch(): UseSearchReturn {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return
    setError(null)
    setLoading(true)
    setSearched(true)
    setLoading(false)
  }, [])

  const clear = useCallback(() => {
    setSearched(false)
    setError(null)
  }, [])

  return { results: [], loading, error, searched, search, clear }
}
