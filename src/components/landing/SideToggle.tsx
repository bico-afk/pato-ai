'use client'

import { useRouter } from 'next/navigation'
import { C } from '@/lib/landingTokens'

/* Alternador de lado (espírito Uber: andar / dirigir).
   Dois caminhos simétricos. O primeiro foca a barra de publicar
   (via callback), o segundo abre o fluxo de oferecer serviço. */
export default function SideToggle({ onResolve }: { onResolve?: () => void }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
      <button type="button" onClick={onResolve}
        style={{
          flex: 1, minWidth: 200, height: 50, borderRadius: 12, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800,
          background: C.amber, color: '#1a1300', border: 'none',
          boxShadow: `0 0 24px ${C.amber}22`, transition: 'filter 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.06)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}>
        Preciso resolver algo
      </button>

      <button type="button" onClick={() => router.push('/prestador')}
        style={{
          flex: 1, minWidth: 200, height: 50, borderRadius: 12, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800,
          background: 'transparent', color: C.text, border: `1px solid ${C.border}`,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.background = 'rgba(45,212,191,0.06)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent' }}>
        Quero ganhar uma renda extra
      </button>
    </div>
  )
}
