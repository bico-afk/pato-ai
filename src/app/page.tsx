'use client'

import { useRef } from 'react'
import Link from 'next/link'
import LandingProvider, { useLanding } from '@/components/landing/LandingProvider'
import TopControls from '@/components/landing/TopControls'
import PublishBar from '@/components/landing/PublishBar'
import DemandFeed from '@/components/demand/DemandFeed'
import LiveGlobe from '@/components/landing/LiveGlobe'
import WorldwideMission from '@/components/landing/WorldwideMission'
import Stats from '@/components/landing/Stats'
import Testimonials from '@/components/landing/Testimonials'
import TwoDoors from '@/components/landing/TwoDoors'
import HowItWorks from '@/components/landing/HowItWorks'
import ClosingBanner from '@/components/landing/ClosingBanner'
import SideToggle from '@/components/landing/SideToggle'
import BikcoChat from '@/components/landing/BikcoChat'

export default function Home() {
  return (
    <LandingProvider>
      <LandingInner />
    </LandingProvider>
  )
}

function LandingInner() {
  const { c, t } = useLanding()
  const heroRef = useRef<HTMLElement>(null)

  function focusPublish() {
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const input = heroRef.current?.querySelector<HTMLInputElement>('input.bikco-query')
    if (input) setTimeout(() => input.focus(), 350)
  }

  return (
    <main style={{ background: c.bg, minHeight: '100dvh', color: c.text, fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* brilhos artísticos de fundo */}
      <div aria-hidden style={{ position: 'absolute', top: -120, left: -80, width: 460, height: 460, background: `radial-gradient(circle, ${c.amber}1f, transparent 62%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden style={{ position: 'absolute', top: 120, right: -120, width: 520, height: 520, background: `radial-gradient(circle, ${c.cyan}1c, transparent 62%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Barra superior: propósito + idioma/tema ──────────── */}
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/sobre" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <span className="purpose-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: c.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, letterSpacing: '0.03em', color: c.text2, fontWeight: 500 }}>{t('purpose')}</span>
          </Link>
          <TopControls />
        </div>

        {/* ── HERO: barra (esq) + globo (dir) ──────────────────── */}
        <section ref={heroRef} className="hero-grid" style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(24px, 5dvh, 56px) 20px 56px' }}>
          <div className="hero-left">
            <h1 className="text-[40px] sm:text-[52px] lg:text-[60px]" style={{ fontWeight: 900, letterSpacing: '-1.6px', lineHeight: 1.07, marginBottom: 14, color: c.text }}>
              {t('hero_title')}
            </h1>
            <p style={{ fontSize: 'clamp(14px, 2vw, 17px)', color: c.text2, lineHeight: 1.6, marginBottom: 28, maxWidth: 520 }}>
              {t('hero_sub')}
            </p>
            <PublishBar />
            <SideToggle onResolve={focusPublish} />
          </div>

          <div className="hero-right">
            <div style={{ position: 'relative', borderRadius: 22, border: `1px solid ${c.border}`, background: 'radial-gradient(circle at 50% 30%, #12131a, #060608)', overflow: 'hidden', height: '100%', minHeight: 360, boxShadow: `0 30px 80px -40px ${c.cyan}55` }}>
              <LiveGlobe />
            </div>
            <p style={{ fontSize: 12.5, color: c.text2, textAlign: 'center', margin: '12px 4px 0', lineHeight: 1.5 }}>
              {t('globe_title')}
            </p>
          </div>
        </section>

        {/* ── MUNDO + GRATUITO + ERA DA IA ─────────────────────── */}
        <WorldwideMission />

        {/* ── NÚMEROS ──────────────────────────────────────────── */}
        <Stats />

        {/* ── PEDIDOS CHEGANDO AGORA (feed real) ───────────────── */}
        <section style={{ borderTop: `1px solid ${c.border}`, paddingTop: 56, background: c.bg }}>
          <DemandFeed title={t('globe_live') === 'live' ? 'Live requests coming in' : 'Pedidos chegando agora'} />
        </section>

        {/* ── DEPOIMENTOS ──────────────────────────────────────── */}
        <Testimonials />

        {/* ── DUAS PORTAS ──────────────────────────────────────── */}
        <TwoDoors onResolve={focusPublish} />

        {/* ── COMO FUNCIONA ────────────────────────────────────── */}
        <HowItWorks />

        {/* ── FAIXA DE FECHO ───────────────────────────────────── */}
        <ClosingBanner onResolve={focusPublish} />

        {/* ── RODAPÉ ───────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${c.border}`, padding: '36px 20px', background: c.bg }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: c.text, margin: 0, letterSpacing: '-0.5px' }}>BIKCO</p>
              <p style={{ fontSize: 12, color: c.text2, margin: '2px 0 0' }}>{t('foot_tagline')}</p>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: t('foot_about'), href: '/sobre' },
                { label: t('foot_pros'), href: '/prestador' },
                { label: t('foot_how'), href: '/sobre' },
                { label: 'WhatsApp', href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}` },
                { label: t('foot_terms'), href: '/termos' },
                { label: t('foot_privacy'), href: '/privacidade' },
              ].map(l => (
                <a key={l.label} href={l.href} style={{ fontSize: 12.5, color: c.text2, textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = c.text2)}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* Chat flutuante no canto */}
      <BikcoChat />

      <style>{`
        .hero-grid { display: grid; grid-template-columns: 1fr; gap: 28px; align-items: start; }
        @media (min-width: 920px) {
          .hero-grid { grid-template-columns: 1.05fr 0.95fr; gap: 40px; }
          .hero-right { position: sticky; top: 72px; }
        }
        .hero-right > div:first-child { height: clamp(360px, 46vw, 460px); }
        .purpose-dot { animation: purpose-blink 2s ease-in-out infinite; }
        @keyframes purpose-blink { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(255,197,61,0.5);} 50% { opacity:0.5; box-shadow:0 0 0 4px rgba(255,197,61,0);} }
        @media (prefers-reduced-motion: reduce) { .purpose-dot { animation: none !important; } }
      `}</style>
    </main>
  )
}
