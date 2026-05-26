'use client'

import { useState, useCallback, useRef } from 'react'

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

/* ── Mock data pool ────────────────────────────────────────── */
const MOCK_POOL: Omit<SearchResult, 'id' | 'city' | 'distanceKm'>[] = [
  { name: 'Carlos Oliveira',  initials: 'CO', description: 'Eletricista residencial e comercial, 12 anos de experiência',  rating: 4.9, ratingCount: 87,  jobsDone: 142 },
  { name: 'Ana Ferreira',     initials: 'AF', description: 'Pintora de interiores e fachadas, orçamento grátis',           rating: 4.8, ratingCount: 61,  jobsDone: 98  },
  { name: 'João Mendes',      initials: 'JM', description: 'Encanador, reparos hidráulicos e instalações sanitárias',      rating: 4.7, ratingCount: 44,  jobsDone: 73  },
  { name: 'Fernanda Lima',    initials: 'FL', description: 'Faxineira e passadeira, atendo residências e escritórios',     rating: 5.0, ratingCount: 123, jobsDone: 211 },
  { name: 'Roberto Santos',   initials: 'RS', description: 'Pedreiro e azulejista, reformas completas',                   rating: 4.6, ratingCount: 38,  jobsDone: 65  },
  { name: 'Mariana Costa',    initials: 'MC', description: 'Doceira artesanal, bolos, doces finos e bem-casados',         rating: 5.0, ratingCount: 156, jobsDone: 289 },
  { name: 'Paulo Rodrigues',  initials: 'PR', description: 'Motorista de frete, mudanças e entregas em geral',            rating: 4.8, ratingCount: 72,  jobsDone: 134 },
  { name: 'Lucia Barbosa',    initials: 'LB', description: 'Manicure e pedicure a domicílio, gel e fibra',                rating: 4.9, ratingCount: 94,  jobsDone: 178 },
]

function generateResults(query: string, cidade: string): SearchResult[] {
  const q = query.toLowerCase()
  const filtered = MOCK_POOL.filter(r =>
    r.description.toLowerCase().includes(q) ||
    r.name.toLowerCase().includes(q)
  )
  const pool = filtered.length > 0 ? filtered : []
  return pool.map((r, i) => ({
    ...r,
    id:          `mock-${i}`,
    city:        cidade || 'São Paulo, SP',
    distanceKm:  Math.floor(Math.random() * 15) + 1,
  }))
}

/* ── Hook ──────────────────────────────────────────────────── */
export function useSearch(): UseSearchReturn {
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const abortRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (query: string, cidade: string) => {
    if (!query.trim()) return
    if (abortRef.current) clearTimeout(abortRef.current)

    setLoading(true)
    setError(null)
    setSearched(false)

    // TODO: replace with Supabase query
    // const { data, error } = await supabase
    //   .from('profiles')
    //   .select('...')
    //   .textSearch('skills', query)
    //   .eq('city', cidade)

    abortRef.current = setTimeout(() => {
      try {
        const data = generateResults(query, cidade)
        setResults(data)
        setSearched(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao buscar')
      } finally {
        setLoading(false)
      }
    }, 600)
  }, [])

  const clear = useCallback(() => {
    setResults([])
    setSearched(false)
    setError(null)
  }, [])

  return { results, loading, error, searched, search, clear }
}
