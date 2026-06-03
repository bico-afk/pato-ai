'use client'

import { useEffect, useRef, useState } from 'react'
import { C } from '@/lib/landingTokens'

/* Três contadores grandes com count-up ao entrar na viewport.
   Números demonstrativos do alcance da rede (não métricas reais).
   tabular-nums para não "pular" durante a animação. */
const STATS = [
  { to: 1280, label: 'bikcos rolando hoje' },
  { to: 340,  label: 'cidades alcançadas' },
  { to: 5600, label: 'pessoas prontas para atender' },
]

function useCountUp(target: number, run: boolean, ms = 1400) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setN(target); return }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - start) / ms, 1)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return n
}

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRun(true); obs.disconnect() } },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} style={{ borderTop: `1px solid ${C.border}`, padding: '72px 20px', background: C.bg }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, textAlign: 'center' }}>
        {STATS.map((s, i) => (
          <StatItem key={i} to={s.to} label={s.label} run={run} />
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: 13, color: C.text2, marginTop: 36 }}>
        Publicar e pedir é de graça. Sempre.
      </p>
    </section>
  )
}

function StatItem({ to, label, run }: { to: number; label: string; run: boolean }) {
  const n = useCountUp(to, run)
  return (
    <div>
      <div style={{ fontSize: 'clamp(40px, 7vw, 64px)', fontWeight: 900, color: C.text, letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {n.toLocaleString('pt-BR')}<span style={{ color: C.amber }}>+</span>
      </div>
      <p style={{ fontSize: 14, color: C.text2, marginTop: 12 }}>{label}</p>
    </div>
  )
}
