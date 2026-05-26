'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ── Icon: person searching ─────────────────────────────────── */
function IconNeed() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

/* ── Icon: person with tools ────────────────────────────────── */
function IconWork() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

interface CardProps {
  icon: React.ReactNode
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
  loading: boolean
}

function OnboardingCard({ icon, title, description, buttonLabel, onClick, loading }: CardProps) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#0f0f0f',
        border: `1px solid ${hover ? '#2a2a2a' : '#1e1e1e'}`,
        borderRadius: 16, padding: '36px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 16, flex: 1,
        transition: 'border-color 0.2s',
        cursor: 'default',
      }}
    >
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>

      <button
        onClick={onClick}
        disabled={loading}
        style={{
          width: '100%', height: 48, borderRadius: 10, border: 'none',
          background: loading ? '#1a1a1a' : '#fff',
          color: loading ? '#444' : '#000',
          fontSize: 14, fontWeight: 800,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          marginTop: 4,
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#00d4ff' }}
        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
      >
        {loading ? (
          <span style={{
            width: 16, height: 16, border: '2px solid #333', borderTopColor: '#fff',
            borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : buttonLabel}
      </button>
    </div>
  )
}

export default function OnboardingPage() {
  const router  = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'hire' | 'work' | null>(null)

  async function markAndRedirect(destination: string, which: 'hire' | 'work') {
    setLoading(which)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase
          .from('users')
          .update({ updated_at: new Date().toISOString() })
          .eq('auth_id', session.user.id)
      }
    } catch { /* non-fatal */ }
    router.push(destination)
  }

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

      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{
              fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 900,
              letterSpacing: '-1px', color: '#fff', marginBottom: 10,
            }}>
              Por onde você começa?
            </h1>
            <p style={{ fontSize: 15, color: '#555' }}>
              Isso não te limita — você pode fazer os dois.
            </p>
          </div>

          {/* Cards */}
          <div style={{
            display: 'flex', gap: 16,
            flexDirection: 'row',
          }}
            className="onboarding-cards"
          >
            <OnboardingCard
              icon={<IconNeed />}
              title="Preciso de ajuda"
              description="Poste o que precisa e receba candidatos de profissionais perto de você."
              buttonLabel="Quero contratar →"
              loading={loading === 'hire'}
              onClick={() => markAndRedirect('/nova-demanda', 'hire')}
            />
            <OnboardingCard
              icon={<IconWork />}
              title="Quero oferecer serviço"
              description="Crie seu perfil e apareça nas buscas. Receba chamados direto no WhatsApp."
              buttonLabel="Quero trabalhar →"
              loading={loading === 'work'}
              onClick={() => markAndRedirect('/criar-perfil', 'work')}
            />
          </div>

          {/* Footnote */}
          <p style={{ textAlign: 'center', fontSize: 13, color: '#333', marginTop: 28 }}>
            Você pode fazer os dois. Isso define só por onde você começa.
          </p>

          {/* Skip link */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link
              href="/feed"
              style={{ fontSize: 14, color: '#888', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888')}
            >
              Explorar o feed primeiro →
            </Link>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          .onboarding-cards { flex-direction: column !important; }
        }
      `}</style>
    </div>
  )
}
