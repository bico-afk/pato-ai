'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanding } from './LandingProvider'

/* Três contadores grandes com count-up ao entrar na viewport.
   Números demonstrativos do alcance da rede (não métricas reais).
   tabular-nums para não "pular" durante a animação. */
const TARGETS = [1280, 340, 5600]

function useCountUp(target: number, run: boolean, ms = 1400) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - start) / ms, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return n
}

export default function Stats() {
  const { c, t } = useLanding()
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)
  const labels = [t('stats_1'), t('stats_2'), t('stats_3')]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); obs.disconnect() } }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} style={{ borderTop: `1px solid ${c.border}`, padding: '72px 20px', background: c.bg }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, textAlign: 'center' }}>
        {TARGETS.map((to, i) => (
          <StatItem key={i} to={to} label={labels[i]} run={run} amber={c.amber} text={c.text} text2={c.text2} />
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: 13, color: c.text2, marginTop: 36 }}>{t('stats_free')}</p>
    </section>
  )
}

function StatItem({ to, label, run, amber, text, text2 }: { to: number; label: string; run: boolean; amber: string; text: string; text2: string }) {
  const n = useCountUp(to, run)
  return (
    <div>
      <div style={{ fontSize: 'clamp(40px, 7vw, 64px)', fontWeight: 900, color: text, letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {n.toLocaleString('pt-BR')}<span style={{ color: amber }}>+</span>
      </div>
      <p style={{ fontSize: 14, color: text2, marginTop: 12 }}>{label}</p>
    </div>
  )
}
