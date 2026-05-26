'use client'

import Link from 'next/link'
import DemandForm from '@/components/demand/DemandForm'

export default function NovaDemandaPage() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #111',
      }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          BIKCO
        </Link>
        <Link href="/feed" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>
          Ver pedidos →
        </Link>
      </header>

      {/* Content */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '40px 20px 60px',
      }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 900,
            letterSpacing: '-0.75px', color: '#fff', marginBottom: 6,
          }}>
            O que você precisa?
          </h1>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 32, lineHeight: 1.6 }}>
            Descreva o serviço. Profissionais da sua região vão se candidatar.
            <br />Você não precisa criar conta para publicar.
          </p>

          <DemandForm />
        </div>
      </main>
    </div>
  )
}
