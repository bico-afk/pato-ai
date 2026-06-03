'use client'

import { useState } from 'react'
import SearchBar from '@/components/landing/SearchBar'
import SearchResults from '@/components/landing/SearchResults'
import { useSearch } from '@/hooks/useSearch'
import type { LocationData } from '@/lib/geo'

/** The full "describe what you need → publish" experience (address autocomplete,
 *  media, AI refine, and publish). Shared between the landing hero and the
 *  "Publicar pedido" page so both have identical options. */
export default function PublishBar() {
  const { results, loading, error, searched, search } = useSearch()
  const [lastQuery,    setLastQuery]    = useState('')
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null)
  const [lastMedia,    setLastMedia]    = useState<string[]>([])

  function handleSearch(query: string, location: LocationData | null, mediaUrls: string[]) {
    setLastQuery(query)
    setLastLocation(location)
    setLastMedia(mediaUrls)
    search(query, location?.city ?? '')
  }

  return (
    <>
      <SearchBar onSearch={handleSearch} loading={loading} />
      <SearchResults
        results={results}
        loading={loading}
        error={error}
        searched={searched}
        query={lastQuery}
        location={lastLocation}
        mediaUrls={lastMedia}
      />
    </>
  )
}
