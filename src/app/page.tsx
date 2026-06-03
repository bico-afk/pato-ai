'use client'

import { useRef } from 'react'
import Link from 'next/link'
import PublishBar from '@/components/landing/PublishBar'
import DemandFeed from '@/components/demand/DemandFeed'
import LiveGlobe from '@/components/landing/LiveGlobe'
import Stats from '@/components/landing/Stats'
import TwoDoors from '@/components/landing/TwoDoors'
import HowItWorks from '@/components/landing/HowItWorks'
import ClosingBanner from '@/components/landing/ClosingBanner'
import SideToggle from '@/components/landing/SideToggle'
import BikcoDuck from '@/components/landing/BikcoDuck'
import { C } from '@/lib/landingTokens'

export default function Home() {
  const heroRef = useRef<HTMLElement>(null)

  function focusPublish() {
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const input = heroRef.current?.querySelector<HTMLInputElement>('input.bikco-query')
    if (input) setTimeout(() => input.focus(), 350)
  }

  return (
    <main style={{ background: C.bg, minHeight: '100dvh', color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── LINHA DE PROPÓSITO (estilo OpenAI) ─────────────────── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 0' }}>
        <Link href="/sobre" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <span className="purpose-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, letterSpacing: '0.04em', color: C.text2, fontWeight: 500 }}>
            Todo mundo precisa de alguém. Todo mundo sabe fazer alguma coisa.
          </span>
        </Link>
      </div>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px', paddingTop: 'clamp(24px, 5dvh, 48px)', paddingBottom: 48 }}>
        <h1 className="text-[40px] sm:text-[52px] lg:text-[60px]" style={{ fontWeight: 900, letterSpacing: '-1.6px', lineHeight: 1.08, marginBottom: 14, color: C.text }}>
          O que você precisa resolver?
        </h1>
        <p style={{ fontSize: 'clamp(14px, 2vw, 17px)', color: C.text2, lineHeight: 1.6, marginBottom: 28, maxWidth: 500 }}>
          Descreva sua necessidade e publique. Profissionais de confiança da sua região encontram você — em minutos. De graça.
        </p>

        {/* Barra de publicação (preservada) */}
        <PublishBar />

        {/* Alternador de lado (os dois lados importam) */}
        <SideToggle onResolve={focusPublish} />
      </section>

      {/* ── GLOBO VIVO (gancho de curiosidade) ─────────────────── */}
      <LiveGlobe />

      {/* ── NÚMEROS QUE ANIMAM ─────────────────────────────────── */}
      <Stats />

      {/* ── PEDIDOS CHEGANDO AGORA (feed real, preservado) ─────── */}
      <section style={{ borderTop: `1px solid ${C.border}`, paddingTop: 56, background: C.bg }}>
        <DemandFeed title="Pedidos chegando agora" />
      </section>

      {/* ── DUAS PORTAS ────────────────────────────────────────── */}
      <TwoDoors onResolve={focusPublish} />

      {/* ── COMO FUNCIONA ──────────────────────────────────────── */}
      <HowItWorks />

      {/* ── FAIXA DE FECHO ─────────────────────────────────────── */}
      <ClosingBanner onResolve={focusPublish} />

      {/* ── RODAPÉ ─────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '36px 20px', background: C.bg }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BikcoDuck size={22} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>BIKCO</p>
              <p style={{ fontSize: 12, color: C.text2, margin: '2px 0 0' }}>Feito no Brasil, para o mundo.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Sobre', href: '/sobre' },
              { label: 'Para profissionais', href: '/prestador' },
              { label: 'Como funciona', href: '/sobre' },
              { label: 'WhatsApp', href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}` },
              { label: 'Termos', href: '/termos' },
              { label: 'Privacidade', href: '/privacidade' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: 12.5, color: C.text2, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                onMouseLeave={e => (e.currentTarget.style.color = C.text2)}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        .purpose-dot { animation: purpose-blink 2s ease-in-out infinite; }
        @keyframes purpose-blink { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(255,197,61,0.5);} 50% { opacity:0.5; box-shadow:0 0 0 4px rgba(255,197,61,0);} }
        @media (prefers-reduced-motion: reduce) { .purpose-dot { animation: none !important; } }
      `}</style>
    </main>
  )
}
