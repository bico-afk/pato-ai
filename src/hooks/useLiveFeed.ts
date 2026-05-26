'use client'

import { useState, useEffect, useRef } from 'react'

export interface FeedItem {
  id:             string
  username:       string
  description:    string
  city:           string
  country:        string
  createdAt:      Date
  candidateCount: number
}

const MAX_ITEMS = 5
const INTERVAL_MS = 4000

/* ── Mock demand pool ──────────────────────────────────────── */
const DEMANDS = [
  { description: 'Preciso de eletricista para instalar tomadas na sala',    city: 'São Paulo',    country: 'BR' },
  { description: 'Pintor para quarto e corredor, 40m², material incluso',   city: 'Rio de Janeiro',country: 'BR' },
  { description: 'Frete para mudança de apartamento, poucas caixas',        city: 'Curitiba',     country: 'BR' },
  { description: 'Doceira para 200 brigadeiros no sábado',                  city: 'Belo Horizonte',country: 'BR' },
  { description: 'Encanador urgente — vazamento no banheiro',               city: 'Fortaleza',    country: 'BR' },
  { description: 'Faxina semanal, apartamento 2 quartos',                   city: 'Taubaté',      country: 'BR' },
  { description: 'Montador de móveis — estante IKEA e guarda-roupa',        city: 'Campinas',     country: 'BR' },
  { description: 'Árbitro para pelada domingo de manhã, 18 jogadores',      city: 'Porto Alegre', country: 'BR' },
  { description: 'Cabeleireira a domicílio, escova e corte',                city: 'Salvador',     country: 'BR' },
  { description: 'Pedreiro para nivelamento de piso, 30m²',                 city: 'Manaus',       country: 'BR' },
  { description: 'Jardineiro para poda e manutenção quinzenal',             city: 'Florianópolis',country: 'BR' },
  { description: 'Técnico de informática, PC lento e sem internet',         city: 'Recife',       country: 'BR' },
]

const PREFIXES = ['usuario', 'cliente', 'user', 'morador', 'buscando']
const SUFFIXES = ['_sp', '_rj', '_mg', '_pr', '_ba', '_ce', '_rs', '_sc']

function randomUsername(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const s = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
  const n = Math.floor(Math.random() * 900) + 100
  return `@${p}${n}${s}`
}

function randomDemand(): FeedItem {
  const d = DEMANDS[Math.floor(Math.random() * DEMANDS.length)]
  return {
    id:             `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username:       randomUsername(),
    description:    d.description,
    city:           d.city,
    country:        d.country,
    createdAt:      new Date(),
    candidateCount: Math.floor(Math.random() * 6),
  }
}

/* ── Hook ──────────────────────────────────────────────────── */
export function useLiveFeed(): FeedItem[] {
  const [items, setItems] = useState<FeedItem[]>(() =>
    // seed with 3 initial items staggered in the past
    Array.from({ length: 3 }, (_, i) => {
      const item = randomDemand()
      item.createdAt = new Date(Date.now() - (i + 1) * 60_000 * (i + 1))
      return item
    })
  )
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // TODO: replace with Supabase Realtime
    // const channel = supabase.channel('posts')
    //   .on('postgres_changes', { event: 'INSERT', ... }, handler)
    //   .subscribe()

    timerRef.current = setInterval(() => {
      setItems(prev => [randomDemand(), ...prev].slice(0, MAX_ITEMS))
    }, INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return items
}
