/* ───────────────────────────────────────────────────────────────
   liveFeed.ts — fonte de dados do "Globo Vivo" e do feed flutuante.

   HOJE retorna dados SIMULADOS porém plausíveis: gente PEDINDO e
   OFERECENDO serviços pelo mundo, em vários idiomas e categorias.

   // TODO: trocar por feed REAL do Supabase (realtime) quando houver volume.
   // Hoje são exemplos demonstrativos do que a rede é/será.
   O selo "ao vivo" se refere à natureza tempo-real da plataforma,
   NÃO afirma que estes itens específicos são reais.
   ─────────────────────────────────────────────────────────────── */

/** Quando virar `true`, getLivePings() deve puxar do Supabase realtime. */
export const USE_REAL_FEED = false

export type PingTipo = 'pedido' | 'oferta'

export interface LivePing {
  id:     string
  tipo:   PingTipo
  cidade: string
  pais:   string
  lat:    number
  lng:    number
  texto:  string
  idioma: string
  handle: string
}

/* Cidades reais (lat/lng) espalhadas pelo mundo para os pontos de luz. */
const CITIES: { cidade: string; pais: string; lat: number; lng: number }[] = [
  { cidade: 'São Paulo',     pais: 'Brasil',        lat: -23.55, lng: -46.63 },
  { cidade: 'Taubaté',       pais: 'Brasil',        lat: -23.03, lng: -45.55 },
  { cidade: 'Araraquara',    pais: 'Brasil',        lat: -21.79, lng: -48.18 },
  { cidade: 'Rio de Janeiro',pais: 'Brasil',        lat: -22.91, lng: -43.17 },
  { cidade: 'Recife',        pais: 'Brasil',        lat:  -8.05, lng: -34.88 },
  { cidade: 'Lisboa',        pais: 'Portugal',      lat:  38.72, lng:  -9.14 },
  { cidade: 'Lagos',         pais: 'Nigéria',       lat:   6.52, lng:   3.38 },
  { cidade: 'Cidade do México', pais: 'México',     lat:  19.43, lng: -99.13 },
  { cidade: 'Buenos Aires',  pais: 'Argentina',     lat: -34.60, lng: -58.38 },
  { cidade: 'Bogotá',        pais: 'Colômbia',      lat:   4.71, lng: -74.07 },
  { cidade: 'Nova York',     pais: 'EUA',           lat:  40.71, lng: -74.01 },
  { cidade: 'Los Angeles',   pais: 'EUA',           lat:  34.05, lng:-118.24 },
  { cidade: 'Londres',       pais: 'Reino Unido',   lat:  51.51, lng:  -0.13 },
  { cidade: 'Madri',         pais: 'Espanha',       lat:  40.42, lng:  -3.70 },
  { cidade: 'Paris',         pais: 'França',        lat:  48.86, lng:   2.35 },
  { cidade: 'Berlim',        pais: 'Alemanha',      lat:  52.52, lng:  13.40 },
  { cidade: 'Mumbai',        pais: 'Índia',         lat:  19.08, lng:  72.88 },
  { cidade: 'Manila',        pais: 'Filipinas',     lat:  14.60, lng: 120.98 },
  { cidade: 'Jacarta',       pais: 'Indonésia',     lat:  -6.21, lng: 106.85 },
  { cidade: 'Nairóbi',       pais: 'Quênia',        lat:  -1.29, lng:  36.82 },
  { cidade: 'Cairo',         pais: 'Egito',         lat:  30.04, lng:  31.24 },
  { cidade: 'Istambul',      pais: 'Turquia',       lat:  41.01, lng:  28.98 },
  { cidade: 'Tóquio',        pais: 'Japão',         lat:  35.68, lng: 139.69 },
  { cidade: 'Sydney',        pais: 'Austrália',     lat: -33.87, lng: 151.21 },
  { cidade: 'Toronto',       pais: 'Canadá',        lat:  43.65, lng: -79.38 },
]

/* Pedidos (quem tem uma dor). */
const PEDIDOS: { texto: string; idioma: string }[] = [
  { texto: 'preciso de uma diarista pra faxina completa',      idioma: 'pt' },
  { texto: 'consertar o chuveiro ainda hoje',                  idioma: 'pt' },
  { texto: 'um frete pequeno pra amanhã de manhã',             idioma: 'pt' },
  { texto: 'alguém pra montar um guarda-roupa',                idioma: 'pt' },
  { texto: 'professor de matemática pro meu filho',            idioma: 'pt' },
  { texto: 'um pedreiro pra um muro pequeno',                  idioma: 'pt' },
  { texto: 'need a plumber to fix a leak today',               idioma: 'en' },
  { texto: 'looking for someone to assemble furniture',        idioma: 'en' },
  { texto: 'busco electricista para instalar lámparas',        idioma: 'es' },
  { texto: 'necesito ayuda con una mudanza pequeña',           idioma: 'es' },
  { texto: 'cherche quelqu’un pour du ménage',                 idioma: 'fr' },
  { texto: 'preciso de um eletricista pra uma tomada',         idioma: 'pt' },
]

/* Ofertas (quem tem tempo ou habilidade). */
const OFERTAS: { texto: string; idioma: string }[] = [
  { texto: 'tô livre hoje pra fretes na região',              idioma: 'pt' },
  { texto: 'faço faxina e passo roupa, ótimas referências',   idioma: 'pt' },
  { texto: 'eletricista, atendo no mesmo dia',                idioma: 'pt' },
  { texto: 'monto móveis e instalo prateleiras',              idioma: 'pt' },
  { texto: 'dou aulas de inglês online à noite',              idioma: 'pt' },
  { texto: 'pintor disponível esta semana',                   idioma: 'pt' },
  { texto: 'available today for small moving jobs',           idioma: 'en' },
  { texto: 'I do home cleaning, great references',            idioma: 'en' },
  { texto: 'disponible para reparaciones eléctricas',         idioma: 'es' },
  { texto: 'hago mudanzas y cargas pequeñas',                 idioma: 'es' },
]

const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** Gera 1 ping aleatório plausível (pedido ou oferta, cidade real). */
export function randomPing(): LivePing {
  const tipo: PingTipo = Math.random() < 0.5 ? 'pedido' : 'oferta'
  const city = pick(CITIES)
  const src  = tipo === 'pedido' ? pick(PEDIDOS) : pick(OFERTAS)
  const prefix = tipo === 'pedido' ? 'anon' : 'pro'
  return {
    id:     `${Date.now()}-${hex()}`,
    tipo,
    cidade: city.cidade,
    pais:   city.pais,
    lat:    city.lat,
    lng:    city.lng,
    texto:  src.texto,
    idioma: src.idioma,
    handle: `@${prefix}_${hex()}`,
  }
}

/**
 * Retorna `count` pings. HOJE são simulados.
 * Quando USE_REAL_FEED for true, trocar por uma leitura do Supabase realtime.
 */
export function getLivePings(count = 6): LivePing[] {
  if (USE_REAL_FEED) {
    // TODO: ler do Supabase (canais realtime de demands/applications).
    return []
  }
  return Array.from({ length: count }, () => randomPing())
}
