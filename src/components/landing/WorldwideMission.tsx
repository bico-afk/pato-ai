'use client'

import { useLanding } from './LandingProvider'
import BikcoDuck from './BikcoDuck'
import Flag from './Flag'

const FLAG_CCS = ['br','pt','us','es','mx','ar','co','fr','de','it','gb','ng','ke','eg','in','cn','jp','ph','id','tr','au','ca','cl','pe','za','nl','se','pl']

export default function WorldwideMission() {
  const { c, t } = useLanding()

  return (
    <section style={{ borderTop: `1px solid ${c.border}`, background: c.bg, position: 'relative', overflow: 'hidden' }}>
      {/* brilho artístico de fundo */}
      <div aria-hidden style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 720, height: 720, background: `radial-gradient(circle, ${c.cyan}14, transparent 60%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto', padding: '84px 20px' }}>

        {/* MUNDO */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.cyan, marginBottom: 14 }}>🌍 {t('world_kicker')}</p>
          <h2 style={{ fontSize: 'clamp(26px, 4.4vw, 44px)', fontWeight: 900, color: c.text, letterSpacing: '-1px', lineHeight: 1.12, margin: '0 auto 16px', maxWidth: 680 }}>
            {t('world_title')}
          </h2>
          <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: c.text2, lineHeight: 1.65, margin: '0 auto', maxWidth: 580 }}>
            {t('world_text')}
          </p>
        </div>

        {/* faixa de bandeiras */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 18, maxWidth: 680, marginInline: 'auto' }}>
          {FLAG_CCS.map((cc, i) => <Flag key={i} cc={cc} size={30} />)}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: c.text2, margin: '0 auto 60px', maxWidth: 520 }}>
          + de <strong style={{ color: c.text }}>90 países</strong> e <strong style={{ color: c.text }}>12 mil cidades</strong> conectadas por serviços humanos.
        </p>

        {/* dois blocos: gratuito + era da IA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* GRATUITO */}
          <div style={{ position: 'relative', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: '32px 30px', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', right: -30, top: -30, fontSize: 160, fontWeight: 900, color: c.amber, opacity: 0.08, lineHeight: 1 }}>$0</div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.amber, margin: '0 0 12px' }}>{t('free_kicker')}</p>
            <h3 style={{ fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 800, color: c.text, letterSpacing: '-0.5px', margin: '0 0 12px', position: 'relative' }}>{t('free_title')}</h3>
            <p style={{ fontSize: 14.5, color: c.text2, lineHeight: 1.65, margin: 0, position: 'relative' }}>{t('free_text')}</p>
          </div>

          {/* ERA DA IA */}
          <div style={{ position: 'relative', background: `linear-gradient(135deg, ${c.cyan}14, ${c.amber}10)`, border: `1px solid ${c.border}`, borderRadius: 20, padding: '32px 30px', overflow: 'hidden' }}>
            <span aria-hidden style={{ position: 'absolute', right: 18, top: 18, opacity: 0.18 }}><BikcoDuck size={72} color={c.cyan} /></span>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.cyan, margin: '0 0 12px' }}>✊ Trabalho humano</p>
            <h3 style={{ fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 800, color: c.text, letterSpacing: '-0.5px', margin: '0 0 12px', maxWidth: 420 }}>{t('ai_title')}</h3>
            <p style={{ fontSize: 14.5, color: c.text2, lineHeight: 1.65, margin: 0, maxWidth: 440 }}>{t('ai_text')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
