'use client'

import Link from 'next/link'
import AuthForm from '@/components/auth/AuthForm'

export default function AuthPage() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <header style={{ padding: '20px 24px' }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          BIKCO
        </Link>
      </header>

      {/* Card */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '24px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: '#0f0f0f', border: '1px solid #1e1e1e',
          borderRadius: 16, padding: '40px 32px',
        }}>
          <h1 style={{
            fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px',
            color: '#fff', marginBottom: 6,
          }}>
            Entrar
          </h1>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 32 }}>
            Novo por aqui? Sua conta é criada automaticamente.
          </p>

          <AuthForm />
        </div>
      </div>
    </div>
  )
}
