'use client'

import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'
import BikcoDuck from './BikcoDuck'

/* Faixa de fecho — emocional e positiva, antes do rodapé. */
export default function ClosingBanner({ onResolve }: { onResolve?: () => void }) {
  const router = useRouter()
  const { c, t } = useLanding()
  return (
    <section style={{ position: 'relative', borderTop: `1px solid ${c.border}`, padding: '88px 20px', textAlign: 'center', overflow: 'hidden', background: c.bg }}>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.05, pointerEvents: 'none' }}>
        <BikcoDuck size={360} color={c.amber} />
      </span>

      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(26px, 4.4vw, 42px)', fontWeight: 900, color: c.text, letterSpacing: '-1px', lineHeight: 1.15, margin: '0 0 14px' }}>
          {t('closing_title')}
        </h2>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: c.text2, margin: '0 0 32px' }}>
          {t('closing_sub')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => (onResolve ? onResolve() : router.push('/'))}
            style={{ height: 52, padding: '0 26px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: c.amber, color: c.ink, boxShadow: `0 0 24px ${c.amber}22` }}>
            {t('closing_a')}
          </button>
          <button onClick={() => router.push('/prestador')}
            style={{ height: 52, padding: '0 26px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: 'transparent', color: c.text, border: `1px solid ${c.border}` }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = c.cyan)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = c.border)}>
            {t('closing_b')}
          </button>
        </div>
      </div>
    </section>
  )
}
