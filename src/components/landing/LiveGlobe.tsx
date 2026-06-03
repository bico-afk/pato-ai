'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { C } from '@/lib/landingTokens'
import { randomPing, type LivePing } from '@/lib/liveFeed'

/* ───────────────────────────────────────────────────────────────
   <LiveGlobe /> — Terra escura girando, arrastável, com pontos de
   luz acendendo em cidades reais. Âmbar = alguém PEDINDO, ciano =
   alguém OFERECENDO. Cards flutuantes aparecem ~4s e somem.

   Fonte de dados: liveFeed.ts (hoje SIMULADO — ver USE_REAL_FEED).
   Sem realismo geográfico: a meta é a SENSAÇÃO de planeta vivo.
   three.js: drag manual (sem OrbitControls), só primitivas estáveis.
   ─────────────────────────────────────────────────────────────── */

const R = 1.6 // raio do globo

function latLngToVec3(lat: number, lng: number, r: number) {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

interface Ping { marker: THREE.Mesh; ring: THREE.Mesh; born: number; ttl: number }

export default function LiveGlobe() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState<{ key: string; ping: LivePing }[]>([])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 640

    // ── Cena / câmera / renderer ──
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.z = 5.2

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'pan-y'

    function resize() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()

    // ── Globo ──
    const globe = new THREE.Group()
    scene.add(globe)

    // esfera escura
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x0d0e12 }),
    ))
    // grid sutil (meridianos/paralelos)
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.003, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.05 }),
    ))
    // "dot matrix" — pontos espalhados pela superfície (planeta vivo)
    {
      const N = isMobile ? 700 : 1400
      const pos = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        const u = Math.random(), v = Math.random()
        const theta = 2 * Math.PI * u
        const phi = Math.acos(2 * v - 1)
        const r = R * 1.004
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r * Math.cos(phi)
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.16 })))
    }
    // leve halo do acento
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.04, side: THREE.BackSide }),
    ))

    globe.rotation.x = 0.35

    // ── Pings ──
    const pings: Ping[] = []
    const ringGeo = new THREE.RingGeometry(0.05, 0.075, 24)

    function spawnPing(p: LivePing) {
      const color = p.tipo === 'pedido' ? 0xffc53d : 0x2dd4bf
      const pos = latLngToVec3(p.lat, p.lng, R * 1.01)

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
      )
      marker.position.copy(pos)

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      )
      ring.position.copy(pos)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize())

      globe.add(marker); globe.add(ring)
      pings.push({ marker, ring, born: performance.now(), ttl: 2600 })

      // card flutuante
      const key = p.id
      setCards(prev => [...prev.slice(-2), { key, ping: p }])
      window.setTimeout(() => setCards(prev => prev.filter(c => c.key !== key)), 4600)
    }

    // ── Drag para girar ──
    let dragging = false, lastX = 0, lastY = 0, vx = 0
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      globe.rotation.y += dx * 0.005
      globe.rotation.x = Math.max(-0.8, Math.min(0.9, globe.rotation.x + dy * 0.005))
      vx = dx * 0.005
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    // ── Loop ──
    let visible = true
    let raf = 0
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.05 })
    io.observe(mount)

    const render = () => {
      const now = performance.now()
      if (!dragging) {
        globe.rotation.y += reduce ? 0 : (vx !== 0 ? vx : 0.0011)
        vx *= 0.95
        if (Math.abs(vx) < 0.0012) vx = 0
      }
      // anima pings
      for (let i = pings.length - 1; i >= 0; i--) {
        const pg = pings[i]
        const t = (now - pg.born) / pg.ttl
        if (t >= 1) {
          globe.remove(pg.marker); globe.remove(pg.ring)
          ;(pg.marker.material as THREE.Material).dispose()
          ;(pg.ring.material as THREE.Material).dispose()
          pg.marker.geometry.dispose()
          pings.splice(i, 1)
          continue
        }
        const s = 1 + t * 5
        pg.ring.scale.setScalar(s)
        ;(pg.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7
        ;(pg.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + (1 - t) * 0.7
        pg.marker.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.6)
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    // ── Spawns ──
    // alguns pings iniciais para o globo já chegar "vivo"
    const seed = isMobile ? 2 : 4
    for (let i = 0; i < seed; i++) window.setTimeout(() => spawnPing(randomPing()), i * 500)
    const spawnEvery = reduce ? 4200 : (isMobile ? 2600 : 1700)
    const spawnTimer = window.setInterval(() => { if (visible) spawnPing(randomPing()) }, spawnEvery)

    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(spawnTimer)
      io.disconnect(); ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      pings.forEach(pg => { globe.remove(pg.marker); globe.remove(pg.ring) })
      ringGeo.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <section style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '64px 20px 72px', overflow: 'hidden' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cyan, marginBottom: 14 }}>
          <span className="lg-livedot" style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan }} />
          ao vivo
        </p>
        <h2 style={{ fontSize: 'clamp(22px, 3.6vw, 34px)', fontWeight: 800, color: C.text, letterSpacing: '-0.6px', lineHeight: 1.2, margin: '0 auto 8px', maxWidth: 620 }}>
          Agora mesmo, pelo mundo todo, gente está resolvendo e ganhando.
        </h2>
        <p style={{ fontSize: 14, color: C.text2, margin: '0 auto 8px', maxWidth: 440 }}>
          <span style={{ color: C.amber, fontWeight: 700 }}>● pedindo</span> &nbsp;·&nbsp; <span style={{ color: C.cyan, fontWeight: 700 }}>● oferecendo</span> &nbsp;— arraste para girar.
        </p>
      </div>

      {/* Globo + cards */}
      <div style={{ position: 'relative', maxWidth: 980, margin: '8px auto 0' }}>
        <div ref={mountRef} style={{ width: '100%', height: 'clamp(360px, 52vw, 560px)' }} />

        {/* Cards flutuantes (fallback textual do globo p/ acessibilidade) */}
        <div aria-live="polite" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, pointerEvents: 'none', maxWidth: 300, width: '42%', minWidth: 220 }}>
          {cards.map(({ key, ping }) => (
            <div key={key} className="lg-card" style={{
              background: 'rgba(20,20,22,0.92)', border: `1px solid ${ping.tipo === 'pedido' ? 'rgba(255,197,61,0.35)' : 'rgba(45,212,191,0.35)'}`,
              borderRadius: 12, padding: '11px 13px', backdropFilter: 'blur(6px)', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ping.tipo === 'pedido' ? C.amber : C.cyan, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: ping.tipo === 'pedido' ? C.amber : C.cyan }}>{ping.handle}</span>
                <span style={{ fontSize: 11, color: C.text2 }}>· agora</span>
              </div>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.4, margin: '0 0 5px' }}>“{ping.texto}”</p>
              <p style={{ fontSize: 11, color: C.text2, margin: 0 }}>
                📍 {ping.cidade}, {ping.pais}{ping.tipo === 'oferta' ? ' · acabou de pegar um bikco' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .lg-livedot { animation: lg-pulse 1.6s ease-in-out infinite; }
        @keyframes lg-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(45,212,191,0.5);} 50% { opacity:0.6; box-shadow:0 0 0 5px rgba(45,212,191,0);} }
        .lg-card { animation: lg-cardin 0.4s ease-out both; }
        @keyframes lg-cardin { from { opacity:0; transform: translateX(12px);} to { opacity:1; transform:none; } }
        @media (max-width: 560px) {
          .lg-card { font-size: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-livedot, .lg-card { animation: none !important; }
        }
      `}</style>
    </section>
  )
}
