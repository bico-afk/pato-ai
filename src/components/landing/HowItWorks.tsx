'use client'

import { useLanding } from './LandingProvider'

/* Como funciona — 3 passos, clareza estilo Uber. */
export default function HowItWorks() {
  const { c, t } = useLanding()
  const steps = [
    { t: t('how1_t'), d: t('how1_d'), icon: <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /> },
    { t: t('how2_t'), d: t('how2_d'), icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
    { t: t('how3_t'), d: t('how3_d'), icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  ]

  return (
    <section style={{ borderTop: `1px solid ${c.border}`, padding: '72px 20px', background: c.bg }}>
      <h2 style={{ fontSize: 'clamp(22px, 3.4vw, 32px)', fontWeight: 800, color: c.text, textAlign: 'center', letterSpacing: '-0.6px', margin: '0 0 48px' }}>
        {t('how_title')}
      </h2>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: `${c.amber}14`, border: `1px solid ${c.amber}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: c.amber, fontVariantNumeric: 'tabular-nums' }}>{`0${i + 1}`}</span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: c.text, margin: 0 }}>{s.t}</h3>
            <p style={{ fontSize: 14, color: c.text2, lineHeight: 1.6, margin: 0 }}>{s.d}</p>
          </div>
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: 15, color: c.text2, marginTop: 36 }}>{t('how_close')}</p>
    </section>
  )
}
