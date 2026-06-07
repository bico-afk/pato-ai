'use client'

import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'
import Flag from './Flag'

/* "Mude de cidade ou país" — o trunfo da Bikco: descubra onde há demanda
   pra sua habilidade no mundo ANTES de se mudar. */
const SPOTS = [
  { cc: 'pt', city: 'Lisboa',    n: 128 },
  { cc: 'us', city: 'Miami',     n: 342 },
  { cc: 'es', city: 'Barcelona', n: 96  },
  { cc: 'de', city: 'Berlim',    n: 74  },
  { cc: 'au', city: 'Sydney',    n: 51  },
]

export default function MoveSection() {
  const { c, t } = useLanding()
  const router = useRouter()

  return (
    <section style={{ borderTop: `1px solid ${c.border}`, background: c.bg, padding: '76px 20px', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', top: '-30%', right: '-10%', width: 560, height: 560, background: `radial-gradient(circle, ${c.amber}14, transparent 60%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 44, alignItems: 'center' }}>

        {/* Texto */}
        <div>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.amber, margin: '0 0 14px' }}>
            ✈️ {t('move_kicker')}
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 900, color: c.text, letterSpacing: '-0.8px', lineHeight: 1.15, margin: '0 0 18px' }}>
            {t('move_title')}
          </h2>
          <p style={{ fontSize: 16, color: c.text2, lineHeight: 1.65, margin: '0 0 26px', maxWidth: 480 }}>
            {t('move_body')}
          </p>
          <button onClick={() => router.push('/prestador')}
            style={{ height: 50, padding: '0 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: c.amber, color: c.ink, boxShadow: `0 0 24px ${c.amber}33` }}>
            {t('move_cta')} →
          </button>
        </div>

        {/* Mapa de oportunidades */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: '22px', boxShadow: '0 30px 70px -34px rgba(0,0,0,0.35)' }}>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.text2, margin: '0 0 16px' }}>
            🌍 {t('move_cta')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SPOTS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, background: c.bgSoft, border: `1px solid ${c.border}` }}>
                <Flag cc={s.cc} size={26} />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: c.text }}>{s.city}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: c.amber, background: `${c.amber}16`, border: `1px solid ${c.amber}40`, borderRadius: 99, padding: '3px 11px', whiteSpace: 'nowrap' }}>
                  {s.n} {t('nav_publish') === 'Post a request' ? 'gigs' : 'pedidos'}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
