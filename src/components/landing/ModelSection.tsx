'use client'

import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'
import BikcoDuck from './BikcoDuck'

/* Seção que cristaliza o MODELO da Bikco:
   "descreva uma vez → receba os bicos certos no WhatsApp, automaticamente".
   Mostra um mockup de notificação do WhatsApp pra ficar tangível. */
export default function ModelSection() {
  const { c, t } = useLanding()
  const router = useRouter()
  const WA = '#25D366'

  return (
    <section style={{ borderTop: `1px solid ${c.border}`, background: c.bgSoft, padding: '72px 20px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 44, alignItems: 'center' }}>

        {/* Texto */}
        <div>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.amber, margin: '0 0 14px' }}>
            ✨ {t('model_kicker')}
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 900, color: c.text, letterSpacing: '-0.8px', lineHeight: 1.15, margin: '0 0 24px' }}>
            {t('model_title')}
          </h2>

          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[t('model_p1'), t('model_p2'), t('model_p3')].map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: i === 2 ? WA : `${c.amber}22`, color: i === 2 ? '#fff' : c.amber, border: i === 2 ? 'none' : `1px solid ${c.amber}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 15.5, color: c.text2, lineHeight: 1.55, paddingTop: 2 }}>{step}</span>
              </li>
            ))}
          </ol>

          <p style={{ fontSize: 14.5, color: c.text, fontWeight: 600, lineHeight: 1.6, margin: '0 0 24px' }}>
            🌐 {t('model_net')}
          </p>

          <button onClick={() => router.push('/prestador')}
            style={{ height: 50, padding: '0 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: c.amber, color: c.ink, boxShadow: `0 0 24px ${c.amber}22` }}>
            {t('model_cta')}
          </button>
        </div>

        {/* Mockup do WhatsApp */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 'min(320px, 100%)', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(0,0,0,0.5)' }}>
            {/* header estilo WhatsApp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: WA }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BikcoDuck size={22} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Bikco</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', margin: 0 }}>online</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4S5 6.3 5 7.7s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>
            </div>
            {/* corpo */}
            <div style={{ padding: '16px 14px 22px', background: c.bgSoft, minHeight: 200 }}>
              <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '4px 14px 14px 14px', padding: '12px 14px', maxWidth: '92%' }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: c.amber, margin: '0 0 6px' }}>🟡 {t('model_wa_title')}</p>
                <p style={{ fontSize: 13.5, color: c.text, lineHeight: 1.5, margin: '0 0 8px', whiteSpace: 'pre-line' }}>{t('model_wa_body')}</p>
                <p style={{ fontSize: 11, color: c.cyan, fontWeight: 700, margin: 0 }}>{t('model_wa_link')} ›</p>
                <p style={{ fontSize: 10, color: c.text2, margin: '8px 0 0', textAlign: 'right' }}>11:42 ✓✓</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
