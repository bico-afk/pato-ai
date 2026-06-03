'use client'

import { C } from '@/lib/landingTokens'

/* Como funciona — 3 passos, clareza estilo Uber. */
const STEPS = [
  {
    title: 'Descreva ou ofereça',
    desc: 'Em texto livre, do seu jeito. Sem formulário chato.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
  },
  {
    title: 'A pessoa certa aparece',
    desc: 'Sem caçar ninguém, sem leilão. Quem pode ajudar encontra você.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Combinem direto',
    desc: 'Pelo chat ou WhatsApp, sem intermediário cobrando no meio.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
]

export default function HowItWorks() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '72px 20px', background: C.bg }}>
      <h2 style={{ fontSize: 'clamp(22px, 3.4vw, 32px)', fontWeight: 800, color: C.text, textAlign: 'center', letterSpacing: '-0.6px', margin: '0 0 48px' }}>
        Como funciona
      </h2>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,197,61,0.08)', border: '1px solid rgba(255,197,61,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{`0${i + 1}`}</span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{s.title}</h3>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: 15, color: C.text2, marginTop: 36 }}>
        Simples assim. E de graça para começar.
      </p>
    </section>
  )
}
