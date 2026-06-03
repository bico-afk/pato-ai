'use client'

import Link from 'next/link'
import PublishBar from '@/components/landing/PublishBar'

export default function NovaDemandaPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px 80px' }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, letterSpacing: '-1px', color: '#fff', marginBottom: 10, lineHeight: 1.1 }}>
          O que você precisa?
        </h1>
        <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: '#475569', lineHeight: 1.6, marginBottom: 28, maxWidth: 480 }}>
          Descreva o serviço, informe seu endereço e publique. Profissionais da sua região entram em contato com você.{' '}
          <Link href="/feed" style={{ color: '#444', textDecoration: 'none' }}>Ver pedidos →</Link>
        </p>

        {/* Mesma barra da landing — endereço, fotos/vídeos, IA e publicação */}
        <PublishBar />
      </main>
    </div>
  )
}
