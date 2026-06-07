'use client'

import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'

/* Faixa de categorias (estilo Airtasker) — mostra a amplitude da Bikco. */
const CATS: { emoji: string; key: string }[] = [
  { emoji: '🧹', key: 'cat_cleaning' },
  { emoji: '⚡', key: 'cat_electrician' },
  { emoji: '🔧', key: 'cat_plumber' },
  { emoji: '🚚', key: 'cat_moving' },
  { emoji: '🎨', key: 'cat_painting' },
  { emoji: '🛠️', key: 'cat_assembly' },
  { emoji: '📚', key: 'cat_lessons' },
  { emoji: '🌱', key: 'cat_gardening' },
  { emoji: '💇', key: 'cat_beauty' },
  { emoji: '💻', key: 'cat_tech' },
]

export default function CategoryChips() {
  const { c, t } = useLanding()
  const router = useRouter()
  return (
    <section style={{ background: c.bg, padding: '8px 20px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: c.text2, margin: '0 0 16px', letterSpacing: '0.02em' }}>
          {t('cat_intro')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {CATS.map((cat, i) => (
            <button key={i} type="button"
              onClick={() => router.push(`/nova-demanda?q=${encodeURIComponent(t(cat.key))}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: c.text, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 99, padding: '9px 15px', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = c.amber; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'none' }}>
              <span style={{ fontSize: 16 }}>{cat.emoji}</span>{t(cat.key)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
