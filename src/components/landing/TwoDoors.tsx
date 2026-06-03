'use client'

import { useRouter } from 'next/navigation'
import { C } from '@/lib/landingTokens'
import BikcoDuck from './BikcoDuck'

/* Duas portas simétricas (clareza Uber sobre os dois lados). */
export default function TwoDoors({ onResolve }: { onResolve?: () => void }) {
  const router = useRouter()
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '72px 20px', background: C.bg }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

        <Door
          accent={C.amber}
          icon={
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01M9 12v.01M9 15v.01" />
            </svg>
          }
          title="Resolva o que precisa"
          desc="Faxina, reparos, frete, montagem, aulas, ajudante pro dia. Você descreve, profissionais da sua região aparecem."
          cta="Publicar um pedido →"
          onClick={() => (onResolve ? onResolve() : router.push('/'))}
        />

        <Door
          accent={C.cyan}
          icon={
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          }
          title="Ganhe fazendo o que sabe"
          desc="Tem tempo livre ou uma habilidade? Faça bikcos perto de você e tenha uma renda extra, no seu ritmo."
          cta="Quero oferecer serviços →"
          onClick={() => router.push('/prestador')}
        />
      </div>
    </section>
  )
}

function Door({ accent, icon, title, desc, cta, onClick }: {
  accent: string; icon: React.ReactNode; title: string; desc: string; cta: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 14,
        overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none' }}>
      {/* pato sutil ao fundo */}
      <span style={{ position: 'absolute', right: 14, top: 14, opacity: 0.12 }}><BikcoDuck size={64} color={accent} /></span>
      {icon}
      <h3 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.4px' }}>{title}</h3>
      <p style={{ fontSize: 14.5, color: C.text2, lineHeight: 1.6, margin: 0, maxWidth: 320 }}>{desc}</p>
      <span style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: accent }}>{cta}</span>
    </button>
  )
}
