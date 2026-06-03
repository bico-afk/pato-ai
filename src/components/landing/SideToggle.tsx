'use client'

import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'

/* Alternador de lado (espírito Uber: andar / dirigir).
   Dois caminhos simétricos. O primeiro foca a barra de publicar
   (via callback), o segundo abre o fluxo de oferecer serviço. */
export default function SideToggle({ onResolve }: { onResolve?: () => void }) {
  const router = useRouter()
  const { c, t } = useLanding()
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
      <button type="button" onClick={onResolve}
        style={{
          flex: 1, minWidth: 200, height: 50, borderRadius: 12, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800,
          background: c.amber, color: c.ink, border: 'none',
          boxShadow: `0 0 24px ${c.amber}22`, transition: 'filter 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.06)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}>
        {t('side_resolve')}
      </button>

      <button type="button" onClick={() => router.push('/prestador')}
        style={{
          flex: 1, minWidth: 200, height: 50, borderRadius: 12, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800,
          background: 'transparent', color: c.text, border: `1px solid ${c.border}`,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = c.cyan; e.currentTarget.style.background = `${c.cyan}10` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = 'transparent' }}>
        {t('side_earn')}
      </button>
    </div>
  )
}
