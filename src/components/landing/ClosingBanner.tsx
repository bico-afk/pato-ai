'use client'

import { useRouter } from 'next/navigation'
import { C } from '@/lib/landingTokens'
import BikcoDuck from './BikcoDuck'

/* Faixa de fecho — emocional e positiva, antes do rodapé. */
export default function ClosingBanner({ onResolve }: { onResolve?: () => void }) {
  const router = useRouter()
  return (
    <section style={{ position: 'relative', borderTop: `1px solid ${C.border}`, padding: '88px 20px', textAlign: 'center', overflow: 'hidden', background: C.bg }}>
      {/* pato grande e sutil ao fundo */}
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.05, pointerEvents: 'none' }}>
        <BikcoDuck size={360} color={C.amber} />
      </span>

      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(26px, 4.4vw, 42px)', fontWeight: 900, color: C.text, letterSpacing: '-1px', lineHeight: 1.15, margin: '0 0 14px' }}>
          Toda necessidade tem alguém do outro lado.
        </h2>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: C.text2, margin: '0 0 32px' }}>
          A Bikco só aproxima os dois.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => (onResolve ? onResolve() : router.push('/'))}
            style={{ height: 52, padding: '0 26px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: C.amber, color: '#1a1300', boxShadow: `0 0 24px ${C.amber}22` }}>
            Resolver algo agora
          </button>
          <button onClick={() => router.push('/prestador')}
            style={{ height: 52, padding: '0 26px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: 'transparent', color: C.text, border: `1px solid ${C.border}` }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.cyan)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
            Começar a ganhar
          </button>
        </div>
      </div>
    </section>
  )
}
