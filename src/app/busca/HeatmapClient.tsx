'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/lib/supabase'

/* ─── Lookup: cidades BR → coordenadas ──────────────────── */
const CITY_COORDS: Record<string, [number, number]> = {
  'São Paulo': [-23.5505, -46.6333],
  'São paulo': [-23.5505, -46.6333],
  'Sao Paulo': [-23.5505, -46.6333],
  'Rio de Janeiro': [-22.9068, -43.1729],
  'Belo Horizonte': [-19.9191, -43.9386],
  'Brasília': [-15.7797, -47.9297],
  'Salvador': [-12.9714, -38.5014],
  'Fortaleza': [-3.7172, -38.5433],
  'Curitiba': [-25.4297, -49.2733],
  'Manaus': [-3.1190, -60.0217],
  'Recife': [-8.0539, -34.8811],
  'Porto Alegre': [-30.0346, -51.2177],
  'Belém': [-1.4558, -48.5044],
  'Goiânia': [-16.6869, -49.2648],
  'Guarulhos': [-23.4543, -46.5338],
  'Campinas': [-22.9055, -47.0608],
  'São Luís': [-2.5364, -44.3066],
  'Maceió': [-9.6658, -35.7350],
  'Natal': [-5.7945, -35.2110],
  'Teresina': [-5.0892, -42.8016],
  'Campo Grande': [-20.4697, -54.6201],
  'João Pessoa': [-7.1195, -34.8450],
  'Osasco': [-23.5329, -46.7916],
  'Santo André': [-23.6639, -46.5383],
  'São Bernardo do Campo': [-23.6939, -46.5650],
  'Ribeirão Preto': [-21.1775, -47.8103],
  'Uberlândia': [-18.9113, -48.2622],
  'Sorocaba': [-23.5015, -47.4526],
  'Cuiabá': [-15.5961, -56.0968],
  'Aracaju': [-10.9167, -37.0500],
  'Joinville': [-26.3045, -48.8487],
  'Juiz de Fora': [-21.7642, -43.3503],
  'Londrina': [-23.3105, -51.1628],
  'Florianópolis': [-27.5954, -48.5480],
  'Ananindeua': [-1.3658, -48.3722],
  'Niterói': [-22.8832, -43.1036],
  'Duque de Caxias': [-22.7856, -43.3117],
  'Nova Iguaçu': [-22.7556, -43.4511],
  'Belford Roxo': [-22.7639, -43.3975],
  'São Gonçalo': [-22.8269, -43.0539],
  'Mogi das Cruzes': [-23.5225, -46.1878],
  'Betim': [-19.9681, -44.1981],
  'Contagem': [-19.9317, -44.0536],
  'Santos': [-23.9608, -46.3336],
  'Porto Velho': [-8.7612, -63.9004],
  'Macapá': [0.0356, -51.0705],
  'Rio Branco': [-9.9754, -67.8249],
  'Palmas': [-10.2491, -48.3243],
  'Boa Vista': [2.8235, -60.6758],
  'Pinheiros': [-23.5626, -46.6866],  // bairro SP
  'Moema': [-23.6028, -46.6680],
  'Itaim Bibi': [-23.5858, -46.6767],
  'Vila Mariana': [-23.5868, -46.6392],
  'Brooklin': [-23.6228, -46.6878],
  'Lapa': [-23.5237, -46.7050],
  'Tatubaté': [-23.0221, -45.5579],
  'Taubaté': [-23.0221, -45.5579],
  'Jundiaí': [-23.1864, -46.8842],
  'Bauru': [-22.3246, -49.0710],
  'Piracicaba': [-22.7253, -47.6492],
  'São José dos Campos': [-23.1794, -45.8869],
  'Mauá': [-23.6678, -46.4611],
  'Diadema': [-23.6861, -46.6208],
  'Carapicuíba': [-23.5241, -46.8378],
}

function normCity(c: string): string {
  return c.trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function findCoords(city: string): [number, number] | null {
  // exact
  if (CITY_COORDS[city]) return CITY_COORDS[city]
  // case-insensitive
  const lower = city.toLowerCase()
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.toLowerCase() === lower) return v
  }
  // normalized (no accents)
  const norm = normCity(city).toLowerCase()
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (normCity(k).toLowerCase() === norm) return v
  }
  return null
}

/* ─── Types ─────────────────────────────────────────────── */
interface CityPoint {
  lat: number
  lng: number
  count: number
  city: string
}

/* ─── Heat layer usando L.circle ─────────────────────────── */
function HeatLayer({ points }: { points: CityPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const layers: L.Layer[] = []
    const maxCount = Math.max(...points.map(p => p.count), 1)

    points.forEach(({ lat, lng, count }) => {
      const t = count / maxCount // 0..1

      // Cor: amarelo → laranja → vermelho conforme intensidade
      const color = t > 0.65 ? '#FF4D6A' : t > 0.35 ? '#FF8C00' : '#FFD11A'

      // Círculo grande difuso (glow)
      const glow = L.circle([lat, lng], {
        radius: 25000 + t * 55000,
        fillColor: color,
        fillOpacity: 0.06 + t * 0.12,
        color: 'transparent',
        weight: 0,
        interactive: false,
      }).addTo(map)

      // Círculo médio
      const mid = L.circle([lat, lng], {
        radius: 10000 + t * 25000,
        fillColor: color,
        fillOpacity: 0.12 + t * 0.20,
        color: 'transparent',
        weight: 0,
        interactive: false,
      }).addTo(map)

      // Círculo central opaco com tooltip
      const core = L.circle([lat, lng], {
        radius: 3500 + t * 8000,
        fillColor: color,
        fillOpacity: 0.5 + t * 0.35,
        color: color,
        weight: 1,
        opacity: 0.3,
      })
        .bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:12px;color:#fff;background:#111;border:1px solid #333;border-radius:8px;padding:6px 10px;line-height:1.5">
            <strong style="color:${color}">${count} bico${count > 1 ? 's' : ''}</strong><br/>📍 <span style="color:#aaa">${points.find(p => p.lat === lat && p.lng === lng)?.city ?? ''}</span>
          </div>`,
          { sticky: true, opacity: 1, className: 'pato-tip' }
        )
        .addTo(map)

      layers.push(glow, mid, core)
    })

    return () => { layers.forEach(l => map.removeLayer(l)) }
  }, [map, points])

  return null
}

/* ─── Componente principal ───────────────────────────────── */
export default function HeatmapClient() {
  const supabase = createClient()
  const [points,  setPoints]  = useState<CityPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [catSel,  setCatSel]  = useState('')
  const mounted = useRef(true)

  const CATS = ['', 'Elétrica', 'Encanamento', 'Limpeza', 'Reformas', 'Pintura', 'Montagem', 'Mudança', 'Jardim', 'Informática', 'Aulas', 'Beleza', 'Pets', 'Design', 'Culinária']
  const CAT_ICONS: Record<string, string> = {
    'Elétrica':'⚡','Encanamento':'🔧','Limpeza':'🧹','Reformas':'🏗️','Pintura':'🎨',
    'Montagem':'📦','Mudança':'🚚','Jardim':'🌿','Informática':'💻','Aulas':'📚',
    'Beleza':'✂️','Pets':'🐾','Design':'🖌️','Culinária':'🍳',
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from('posts')
        .select('city, category')
        .eq('status', 'aberto')
        .not('city', 'is', null)

      if (catSel) q = q.eq('category', catSel)

      const { data } = await q.limit(2000)
      if (!mounted.current || !data) return

      setTotal(data.length)

      // Agrupa por cidade
      const counts: Record<string, { count: number; city: string }> = {}
      data.forEach(({ city }) => {
        if (!city) return
        const key = city.trim().toLowerCase()
        if (!counts[key]) counts[key] = { count: 0, city: city.trim() }
        counts[key].count++
      })

      // Converte para pontos com coordenadas
      const pts: CityPoint[] = []
      for (const { city, count } of Object.values(counts)) {
        const coords = findCoords(city)
        if (coords) pts.push({ lat: coords[0], lng: coords[1], count, city })
      }

      // Ordena por count desc (maiores desenhados por último = por cima)
      pts.sort((a, b) => a.count - b.count)

      if (mounted.current) { setPoints(pts); setLoading(false) }
    }
    load()
  }, [catSel]) // eslint-disable-line react-hooks/exhaustive-deps

  const center: [number, number] = [-15.0, -51.0] // Brasil centralizado

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #222' }}>

      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        background: 'linear-gradient(135deg,#0f1a00,#111)',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#FFD11A', letterSpacing: '0.05em' }}>
            🌡️ MAPA DE CALOR
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#555' }}>
            {loading ? 'Carregando…' : `${total} bico${total !== 1 ? 's' : ''} ativos no mapa`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#444' }}>Legenda:</span>
          {[['#FFD11A','baixo'],['#FF8C00','médio'],['#FF4D6A','alto']].map(([c,l]) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c }} />
              <span style={{ fontSize: 9, color: '#555' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtro de categoria */}
      <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', gap: 6, padding: '8px 10px', background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
        {CATS.map(cat => {
          const sel = catSel === cat
          return (
            <button key={cat} onClick={() => setCatSel(cat)} style={{
              flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 20,
              border: sel ? 'none' : '1px solid #242424',
              backgroundColor: sel ? '#FFD11A' : '#141414',
              color: sel ? '#0F0F0F' : '#666',
              fontSize: 11, fontWeight: sel ? 800 : 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              {cat ? `${CAT_ICONS[cat] ?? ''} ${cat}` : 'Todos'}
            </button>
          )
        })}
      </div>

      {/* Mapa */}
      <div style={{ position: 'relative', height: 280 }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,15,15,0.7)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ color: '#555', fontSize: 12, margin: 0 }}>Calculando densidade…</p>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={4}
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          {!loading && <HeatLayer points={points} />}
        </MapContainer>
      </div>

      {/* Footer stats */}
      {!loading && points.length > 0 && (
        <div style={{
          padding: '8px 14px',
          background: '#0a0a0a',
          borderTop: '1px solid #1a1a1a',
          display: 'flex', gap: 16,
        }}>
          {points
            .slice().sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((p, i) => (
              <div key={p.city} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: i === 0 ? '#FF4D6A' : i === 1 ? '#FF8C00' : '#FFD11A' }}>
                  {i === 0 ? '🔥' : i === 1 ? '🟠' : '🟡'}
                </span>
                <span style={{ fontSize: 11, color: '#666' }}>{p.city}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa' }}>{p.count}</span>
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .leaflet-container { background: #0a0a0a !important; }
        .pato-tip .leaflet-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
