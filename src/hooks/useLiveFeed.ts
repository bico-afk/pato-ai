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

/* ── Mock demand pool (20 distinct items) ──────────────────── */
const DEMANDS: { description: string; city: string; state: string }[] = [
  { description: 'Eletricista para instalar tomadas na sala',              city: 'São Paulo',       state: 'sp' },
  { description: 'Cabeleireira a domicílio, escova e corte',               city: 'Rio de Janeiro',  state: 'rj' },
  { description: 'Frete para mudança de apartamento',                      city: 'Belo Horizonte',  state: 'mg' },
  { description: 'Pintor para quarto, 12m²',                               city: 'Salvador',        state: 'ba' },
  { description: 'Árbitro para pelada domingo de manhã, 18 jogadores',     city: 'Porto Alegre',    state: 'rs' },
  { description: 'Jardineiro para poda e manutenção quinzenal',            city: 'Florianópolis',   state: 'sc' },
  { description: 'Doceira para 80 brigadeiros recheados',                  city: 'Fortaleza',       state: 'ce' },
  { description: 'Montador de móveis — estante e guarda-roupa',            city: 'Curitiba',        state: 'pr' },
  { description: 'Diarista para limpeza pesada, 3 cômodos',                city: 'Goiânia',         state: 'go' },
  { description: 'Mecânico para revisão de moto Honda CG',                 city: 'Recife',          state: 'pe' },
  { description: 'Costureira para ajuste de vestido de festa',             city: 'Campinas',        state: 'sp' },
  { description: 'Babá para duas crianças, sábado à tarde',                city: 'Manaus',          state: 'am' },
  { description: 'Encanador — vazamento embaixo da pia',                   city: 'Natal',           state: 'rn' },
  { description: 'Professor de reforço — matemática, 8º ano',              city: 'Taubaté',         state: 'sp' },
  { description: 'Designer para logo de barbearia',                        city: 'Maceió',          state: 'al' },
  { description: 'Fotógrafo para aniversário de 1 ano',                    city: 'Belo Horizonte',  state: 'mg' },
  { description: 'Marido de aluguel — prateleiras e box do banheiro',      city: 'São Paulo',       state: 'sp' },
  { description: 'Chaveiro — chave quebrou na fechadura',                  city: 'Rio de Janeiro',  state: 'rj' },
  { description: 'Digitador para transcrição de documentos',               city: 'Fortaleza',       state: 'ce' },
  { description: 'Manicure a domicílio para 4 pessoas',                    city: 'Salvador',        state: 'ba' },
]

const PREFIXES = ['usuario', 'morador', 'cliente', 'user']

function randomUsername(state: string): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const n = Math.floor(Math.random() * 900) + 100
  return `@${p}${n}_${state}`
}

/* ── No-repeat shuffle state ───────────────────────────────── */
// Shuffled indices; refilled when exhausted
let shuffled: number[] = []
let visibleDescriptions = new Set<string>()

function nextDemandIndex(): number {
  if (shuffled.length === 0) {
    // Fisher-Yates shuffle of indices 0..N-1
    const arr = Array.from({ length: DEMANDS.length }, (_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    shuffled = arr
  }
  return shuffled.pop()!
}

function randomDemand(currentItems: FeedItem[]): FeedItem {
  visibleDescriptions = new Set(currentItems.map(i => i.description))

  let idx: number
  let attempts = 0
  do {
    idx = nextDemandIndex()
    attempts++
    // Guard: if all demands are visible (shouldn't happen with 20 items / 5 slots), break
    if (attempts > DEMANDS.length) break
  } while (visibleDescriptions.has(DEMANDS[idx].description))

  const d = DEMANDS[idx]
  return {
    id:             `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username:       randomUsername(d.state),
    description:    d.description,
    city:           d.city,
    country:        'BR',
    createdAt:      new Date(),
    candidateCount: Math.floor(Math.random() * 6),
  }
}

/* ── Hook ──────────────────────────────────────────────────── */
export function useLiveFeed(): FeedItem[] {
  const [items, setItems] = useState<FeedItem[]>(() =>
    // seed with 3 initial items staggered in the past
    Array.from({ length: 3 }, (_, i) => {
      const item = randomDemand([])
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
      setItems(prev => {
        const next = randomDemand(prev)
        return [next, ...prev].slice(0, MAX_ITEMS)
      })
    }, INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return items
}
