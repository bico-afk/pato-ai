'use client'

import { useEffect, useRef, useState } from 'react'
import type { GlobeInstance } from 'globe.gl'

/* ═══════════════════════════════════════════════════════════════
   SERVICE POINTS — 6k pontos ponderados por continente
   Gerado deterministicamente com PRNG semead.
   hexBinPointsData agrega estes pontos em células hexagonais —
   6k produz o mesmo efeito visual que 100k com 15x menos RAM.
═══════════════════════════════════════════════════════════════ */
interface ServicePoint { lat: number; lng: number }

function buildServicePoints(n = 6_000): ServicePoint[] {
  let s = 0x9e3779b9 >>> 0
  const rnd = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
  const zones: [number, number, number, number, number][] = [
    [ 10,  55,  60, 148, 30],
    [ 30,  72, -12,  45, 22],
    [ 25,  50,-127, -65, 15],
    [ -8,  37, -18,  52, 18],
    [-56,  12, -82, -34, 10],
    [-45, -10, 110, 155,  4],
    [ 55,  72,  30, 180,  1],
  ]
  const total = zones.reduce((a, z) => a + z[4], 0)
  const pts: ServicePoint[] = []
  for (let i = 0; i < n; i++) {
    let r = rnd() * total
    let z = zones[0]
    for (const zone of zones) { r -= zone[4]; if (r <= 0) { z = zone; break } }
    pts.push({ lat: z[0] + rnd() * (z[1] - z[0]), lng: z[2] + rnd() * (z[3] - z[2]) })
  }
  return pts
}

const SERVICE_POINTS = buildServicePoints(6_000)

/* ═══════════════════════════════════════════════════════════════
   CITY MARKERS — 8 cidades (top por volume) com rings + tooltip
═══════════════════════════════════════════════════════════════ */
interface CityPoint { lat: number; lng: number; name: string; count: number; size: number }

const CITIES: CityPoint[] = [
  { lat: -23.5505, lng: -46.6333, name: 'São Paulo',      count: 142, size: 0.55 },
  { lat:  40.7128, lng: -74.0060, name: 'New York',       count:  89, size: 0.45 },
  { lat:  19.0760, lng:  72.8777, name: 'Mumbai',         count:  78, size: 0.42 },
  { lat:  51.5074, lng:  -0.1278, name: 'London',         count:  67, size: 0.38 },
  { lat:  31.2304, lng: 121.4737, name: 'Shanghai',       count:  95, size: 0.47 },
  { lat:  48.8566, lng:   2.3522, name: 'Paris',          count:  63, size: 0.37 },
  { lat:  34.0522, lng: -118.243, name: 'Los Angeles',    count:  58, size: 0.35 },
  { lat:  35.6762, lng: 139.6503, name: 'Tokyo',          count:  54, size: 0.35 },
]

/* ─── Fallback sem WebGL ─────────────────────────────────────── */
function GlobeFallback() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 40% 40%, #0a1628 0%, #050c18 60%, #000 100%)',
    }}>
      <div style={{ fontSize: 140, opacity: 0.1, userSelect: 'none' }}>🌍</div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════ */
export default function GlobeScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef     = useRef<GlobeInstance | null>(null)
  const [tooltip,   setTooltip]   = useState<{ text: string; x: number; y: number } | null>(null)
  const [clickHint, setClickHint] = useState<string | null>(null)
  const [webgl,     setWebgl]     = useState(true)
  const [ready,     setReady]     = useState(false)

  useEffect(() => {
    /* ── WebGL check ── */
    try {
      const c = document.createElement('canvas')
      if (!c.getContext('webgl') && !c.getContext('experimental-webgl')) {
        setWebgl(false); return
      }
    } catch { setWebgl(false); return }

    if (!containerRef.current) return
    let alive = true

    void (async () => {
      try {
        const { default: Globe } = await import('globe.gl')
        if (!alive || !containerRef.current) return

        const el = containerRef.current
        const w  = el.clientWidth  || el.offsetWidth  || window.innerWidth
        const h  = el.clientHeight || el.offsetHeight || window.innerHeight

        const globe = new Globe(el)
        globeRef.current = globe

        globe
          .width(w)
          .height(h)
          .backgroundColor('rgba(0,0,0,0)')

          /* ── Textura dia simples (sem bump map — mais leve) ── */
          .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
          .atmosphereColor('#1e5aaa')
          .atmosphereAltitude(0.2)

          /* ── Heatmap hexagonal de serviços ── */
          .hexBinPointsData(SERVICE_POINTS)
          .hexBinPointLat((d: object) => (d as ServicePoint).lat)
          .hexBinPointLng((d: object) => (d as ServicePoint).lng)
          .hexBinPointWeight(() => 1)
          .hexBinResolution(3)
          .hexMargin(0.25)
          .hexAltitude((d: object) => {
            const bin = d as { sumWeight: number }
            return Math.min(bin.sumWeight * 0.0025, 0.12)
          })
          .hexTopColor(() => 'rgba(255,209,26,0.6)')
          .hexSideColor(() => 'rgba(255,140,0,0.2)')

          /* ── City dots (merged = 1 draw call) ── */
          .pointsData(CITIES)
          .pointLat((d: object) => (d as CityPoint).lat)
          .pointLng((d: object) => (d as CityPoint).lng)
          .pointColor((d: object) => (d as CityPoint).count > 80 ? '#FF6B00' : '#FFD11A')
          .pointRadius((d: object) => (d as CityPoint).size)
          .pointAltitude(0.02)
          .pointsMerge(true)

          /* ── Rings (8 cidades, menos GPU) ── */
          .ringsData(CITIES)
          .ringLat((d: object) => (d as CityPoint).lat)
          .ringLng((d: object) => (d as CityPoint).lng)
          .ringColor((d: object) => {
            const city = d as CityPoint
            const rgb  = city.count > 80 ? '255,107,0' : '255,209,26'
            return (t: number) => `rgba(${rgb},${Math.sqrt(1 - t) * 0.7})`
          })
          .ringMaxRadius((d: object) => (d as CityPoint).size * 4 + 1)
          .ringPropagationSpeed(1.2)
          .ringRepeatPeriod((d: object) => {
            const idx = CITIES.indexOf(d as CityPoint)
            return 1200 + (idx % 5) * 300
          })

          /* ── Hover tooltip ── */
          .onPointHover((point: object | null) => {
            if (point) {
              const city = point as CityPoint
              setTooltip(prev => ({
                text: `${city.name} — ${city.count} pedidos ativos`,
                x: prev?.x ?? 0,
                y: prev?.y ?? 0,
              }))
            } else {
              setTooltip(null)
            }
          })

          /* ── Click cidade → zoom ── */
          .onPointClick((point: object) => {
            const city = point as CityPoint
            globe.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.0 }, 900)
            setClickHint(city.name)
            setTimeout(() => setClickHint(null), 2000)
          })

          /* ── Click qualquer ponto do globo → fly to ── */
          .onGlobeClick(({ lat, lng }: { lat: number; lng: number }) => {
            globe.pointOfView({ lat, lng, altitude: 1.3 }, 900)
          })

        /* ── Controls ── */
        const ctrl = globe.controls()
        if (ctrl) {
          ctrl.autoRotate    = false
          ctrl.enableDamping = true
          ctrl.dampingFactor = 0.1
          ctrl.minDistance   = 160
          ctrl.maxDistance   = 750
        }

        /* ── Mouse → tooltip position ── */
        const onMouseMove = (e: MouseEvent) => {
          setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
        }
        el.addEventListener('mousemove', onMouseMove)

        /* ── Resize ── */
        const onResize = () => {
          if (!containerRef.current || !globeRef.current) return
          globeRef.current
            .width(containerRef.current.clientWidth || window.innerWidth)
            .height(containerRef.current.clientHeight || window.innerHeight)
        }
        window.addEventListener('resize', onResize)

        if (alive) setReady(true)
        return () => window.removeEventListener('resize', onResize)
      } catch (e) {
        console.error('[GlobeScene]', e)
        if (alive) setWebgl(false)
      }
    })()

    return () => {
      alive = false
      if (globeRef.current) {
        try { // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(globeRef.current as any)._destructor?.()
        } catch { /* noop */ }
        globeRef.current = null
      }
    }
  }, [])

  if (!webgl) return <GlobeFallback />

  return (
    <>
      {/* Loading */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 48% 48%, #0a1628 0%, #050c18 55%, #000 100%)',
        }}>
          <div style={{
            width: 44, height: 44,
            border: '3px solid #0c1e3a', borderTopColor: '#1e5aaa',
            borderRadius: '50%', animation: 'spin 0.9s linear infinite',
          }} />
        </div>
      )}

      {/* Globe canvas */}
      <div
        ref={containerRef}
        style={{
          width: '100%', height: '100%',
          minHeight: '100dvh',
          opacity: ready ? 1 : 0,
          transition: 'opacity 1.2s ease',
          cursor: 'grab',
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.y - 52,
          left: tooltip.x,
          transform: 'translateX(-50%)',
          background: 'rgba(4,8,18,0.96)',
          color: '#FFD11A',
          fontSize: 12, fontWeight: 700,
          borderRadius: 10,
          padding: '8px 16px',
          pointerEvents: 'none',
          border: '1px solid rgba(255,209,26,0.3)',
          zIndex: 9999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 28px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
        }}>
          📍 {tooltip.text}
        </div>
      )}

      {/* Click flash */}
      {clickHint && (
        <div style={{
          position: 'fixed',
          bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,209,26,0.1)',
          color: '#FFD11A',
          fontSize: 13, fontWeight: 700,
          borderRadius: 99,
          padding: '8px 20px',
          border: '1px solid rgba(255,209,26,0.3)',
          zIndex: 9999, whiteSpace: 'nowrap',
          boxShadow: '0 0 24px rgba(255,209,26,0.15)',
          backdropFilter: 'blur(10px)',
        }}>
          ✈️ Voando para {clickHint}
        </div>
      )}
    </>
  )
}
