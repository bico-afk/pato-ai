'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useLanding } from './LandingProvider'
import { randomPing, type LivePing } from '@/lib/liveFeed'

/* ───────────────────────────────────────────────────────────────
   <LiveGlobe /> — Terra escura girando, arrastável, com pontos de
   luz acendendo em cidades reais. Âmbar = alguém PEDINDO, ciano =
   alguém OFERECENDO. Cards flutuantes aparecem ~4s e somem.
   Widget compacto: encaixa ao lado da barra de publicar no hero.
   Fonte de dados: liveFeed.ts (hoje SIMULADO — ver USE_REAL_FEED).
   three.js: drag manual (sem OrbitControls), só primitivas estáveis.
   ─────────────────────────────────────────────────────────────── */

const R = 1.6

function latLngToVec3(lat: number, lng: number, r: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

interface Ping { marker: THREE.Mesh; ring: THREE.Mesh; born: number; ttl: number }

export default function LiveGlobe() {
  const { c, t } = useLanding()
  const mountRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState<{ key: string; ping: LivePing }[]>([])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 640

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.z = 5.1

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'pan-y'

    function resize() {
      const w = mount!.clientWidth, h = mount!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()

    const globe = new THREE.Group()
    scene.add(globe)
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 48), new THREE.MeshBasicMaterial({ color: 0x0d0e12 })))
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.003, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.05 })))
    {
      const N = isMobile ? 700 : 1400
      const pos = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        const u = Math.random(), v = Math.random()
        const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1), r = R * 1.004
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r * Math.cos(phi)
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb0c0, size: 0.013, transparent: true, opacity: 0.22 })))
    }
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 32, 32), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.05, side: THREE.BackSide })))
    globe.rotation.x = 0.35

    const pings: Ping[] = []
    const ringGeo = new THREE.RingGeometry(0.05, 0.075, 24)

    function spawnPing(p: LivePing) {
      const color = p.tipo === 'pedido' ? 0xffc53d : 0x2dd4bf
      const pos = latLngToVec3(p.lat, p.lng, R * 1.01)
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }))
      marker.position.copy(pos)
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
      ring.position.copy(pos)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize())
      globe.add(marker); globe.add(ring)
      pings.push({ marker, ring, born: performance.now(), ttl: 2600 })
      // mantém SEMPRE os 5 últimos (mais recente no topo)
      setCards(prev => [{ key: p.id, ping: p }, ...prev].slice(0, 5))
    }

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

    let visible = true, raf = 0
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.05 })
    io.observe(mount)

    const render = () => {
      const now = performance.now()
      if (!dragging) { globe.rotation.y += reduce ? 0 : (vx !== 0 ? vx : 0.0012); vx *= 0.95; if (Math.abs(vx) < 0.0013) vx = 0 }
      for (let i = pings.length - 1; i >= 0; i--) {
        const pg = pings[i]
        const tt = (now - pg.born) / pg.ttl
        if (tt >= 1) {
          globe.remove(pg.marker); globe.remove(pg.ring)
          ;(pg.marker.material as THREE.Material).dispose(); (pg.ring.material as THREE.Material).dispose(); pg.marker.geometry.dispose()
          pings.splice(i, 1); continue
        }
        pg.ring.scale.setScalar(1 + tt * 5)
        ;(pg.ring.material as THREE.MeshBasicMaterial).opacity = (1 - tt) * 0.7
        ;(pg.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + (1 - tt) * 0.7
        pg.marker.scale.setScalar(1 + Math.sin(tt * Math.PI) * 0.6)
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    // já começa com os 5 últimos preenchidos
    for (let i = 0; i < 5; i++) window.setTimeout(() => spawnPing(randomPing()), i * 350)
    const spawnTimer = window.setInterval(() => { if (visible) spawnPing(randomPing()) }, reduce ? 5000 : 3600)

    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf); clearInterval(spawnTimer); io.disconnect(); ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
      pings.forEach(pg => { globe.remove(pg.marker); globe.remove(pg.ring) })
      ringGeo.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ width: '100%' }}>
      {/* Painel do globo */}
      <div style={{ position: 'relative', borderRadius: 22, border: `1px solid ${c.border}`, background: 'radial-gradient(circle at 50% 30%, #12131a, #060608)', overflow: 'hidden', height: 'clamp(300px, 42vw, 400px)', boxShadow: `0 30px 80px -40px ${c.cyan}55` }}>
        <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 2, display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'none' }}>
          <span className="lg-livedot" style={{ width: 8, height: 8, borderRadius: '50%', background: c.cyan }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.cyan }}>{t('globe_live')}</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 2, fontSize: 11, color: '#9aa', pointerEvents: 'none', textAlign: 'right' }}>
          <span style={{ color: c.amber, fontWeight: 700 }}>● {t('globe_asking')}</span> · <span style={{ color: c.cyan, fontWeight: 700 }}>● {t('globe_offering')}</span>
        </div>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#9aa', margin: 0, pointerEvents: 'none' }}>↔ {t('globe_drag')}</p>
      </div>

      {/* CTA: cadastre-se como profissional */}
      <a href="/prestador" style={{ display: 'block', textAlign: 'center', marginTop: 12, padding: '12px 14px', borderRadius: 12, background: `${c.cyan}14`, border: `1px solid ${c.cyan}44`, color: c.cyan, fontSize: 13.5, fontWeight: 700, textDecoration: 'none', lineHeight: 1.4 }}>
        {t('live_cta')}
      </a>

      {/* Lista: sempre os 5 últimos */}
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {cards.map(({ key, ping }) => (
          <div key={key} className="lg-card" style={{
            background: c.surface, border: `1px solid ${ping.tipo === 'pedido' ? `${c.amber}44` : `${c.cyan}44`}`,
            borderRadius: 12, padding: '10px 13px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ping.tipo === 'pedido' ? c.amber : c.cyan, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: ping.tipo === 'pedido' ? c.amber : c.cyan }}>{ping.handle}</span>
              <span style={{ fontSize: 11, color: c.text2 }}>· {ping.cidade}, {ping.pais}</span>
            </div>
            <p style={{ fontSize: 13, color: c.text, lineHeight: 1.4, margin: 0 }}>“{ping.texto}”</p>
          </div>
        ))}
      </div>

      <style>{`
        .lg-livedot { animation: lg-pulse 1.6s ease-in-out infinite; }
        @keyframes lg-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(45,212,191,0.5);} 50% { opacity:0.6; box-shadow:0 0 0 5px rgba(45,212,191,0);} }
        .lg-card { animation: lg-cardin 0.35s ease-out both; }
        @keyframes lg-cardin { from { opacity:0; transform: translateY(-6px);} to { opacity:1; transform:none; } }
        @media (prefers-reduced-motion: reduce) { .lg-livedot, .lg-card { animation: none !important; } }
      `}</style>
    </div>
  )
}
