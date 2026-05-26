'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image         from 'next/image'
import { createClient } from '@/lib/supabase'

/* ─── Google icon ─────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

/* ─── Forgot password modal ───────────────────────────────── */
function ForgotModal({ onClose }: { onClose: () => void }) {
  const [resetEmail,  setResetEmail]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [error,       setError]       = useState('')
  const [focused,     setFocused]     = useState(false)

  async function handleReset() {
    if (!resetEmail.trim() || loading) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: e } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?type=recovery`
        : undefined,
    })
    setLoading(false)
    if (e) { setError(e.message); return }
    setSent(true)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 420, zIndex: 201,
        backgroundColor: '#141414', borderRadius: '24px 24px 0 0',
        border: '1px solid #2A2A2A', borderBottom: 'none',
        padding: '24px 24px 48px',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#333', margin: '0 auto 24px' }} />

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>E-mail enviado!</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 24 }}>
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
            <button
              onClick={onClose}
              style={{ height: 48, borderRadius: 14, border: 'none', background: '#FFD11A', color: '#0F0F0F', fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontSize: 14 }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Esqueci a senha</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </p>

            {error && (
              <div style={{ background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#FF6B6B' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', height: 54,
              background: '#1A1A1A',
              border: `1.5px solid ${focused ? '#FFD11A' : '#2E2E2E'}`,
              borderRadius: 14, padding: '0 16px', gap: 10, marginBottom: 16,
              boxShadow: focused ? '0 0 0 3px rgba(255,209,26,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="seu@email.com"
                autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
              />
            </div>

            <button
              onClick={handleReset}
              disabled={!resetEmail.trim() || loading}
              style={{
                width: '100%', height: 52, borderRadius: 14, border: 'none',
                background: resetEmail.trim() ? 'linear-gradient(135deg, #FFD11A, #FF9500)' : '#1A1A1A',
                color: resetEmail.trim() ? '#0F0F0F' : '#444',
                fontSize: 14, fontWeight: 800, cursor: resetEmail.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, border: '2.5px solid rgba(0,0,0,0.2)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : '📨 Enviar link de acesso'}
            </button>
          </>
        )}
      </div>
    </>
  )
}

/* ─── Page ────────────────────────────────────────────────── */
function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const pendingQuery = searchParams.get('q') ?? ''

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [focused,     setFocused]     = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [gLoading,    setGLoading]    = useState(false)
  const [error,       setError]       = useState('')
  const [showForgot,  setShowForgot]  = useState(false)

  const isValid = /\S+@\S+\.\S+/.test(email) && password.length >= 6

  function inputBox(field: string, hasError: boolean): React.CSSProperties {
    const isFocused = focused === field
    return {
      display: 'flex', alignItems: 'center',
      height: 56, background: '#1A1A1A',
      border: `1.5px solid ${hasError ? '#E24B4A' : isFocused ? '#FFD11A' : '#2E2E2E'}`,
      borderRadius: 14, padding: '0 16px', gap: 12,
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: isFocused && !hasError ? '0 0 0 3px rgba(255,209,26,0.08)' : 'none',
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || loading) return
    setError(''); setLoading(true)

    const supabase = createClient()
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (loginError) {
      setLoading(false)
      if (loginError.message.toLowerCase().includes('invalid login credentials')) {
        setError('E-mail ou senha incorretos. Tente novamente.')
      } else if (loginError.message.toLowerCase().includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de fazer login.')
      } else {
        setError(loginError.message)
      }
      return
    }

    if (!data.session) {
      setLoading(false)
      setError('Não foi possível iniciar sessão. Tente novamente.')
      return
    }

    // Vai direto para a busca — com query pendente ou busca vazia
    router.push(pendingQuery ? `/resultados?q=${encodeURIComponent(pendingQuery)}` : '/resultados')
  }

  async function handleGoogle() {
    setGLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined,
      },
    })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0F0F0F',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative background pato */}
      <img
        src="/pato-icon.svg"
        alt=""
        aria-hidden
        style={{
          position: 'absolute', bottom: -30, right: -50,
          width: 340, height: 340, opacity: 0.04,
          pointerEvents: 'none', userSelect: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 36 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #FFD11A, #FF9500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255,209,26,0.2)',
          }}>
            <Image src="/pato-icon.svg" alt="Bikco" width={24} height={24} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>
            bikco<span style={{ color: '#FFD11A' }}>.com</span>
          </span>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Bem-vindo{' '}
            <span style={{ color: '#FFD11A', fontStyle: 'italic' }}>de volta.</span>
          </h1>
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
            Continue encontrando os melhores profissionais
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            fontSize: 13, color: '#FF6B6B', lineHeight: 1.5,
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── E-mail ── */}
          <div style={inputBox('email', false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused === 'email' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="seu@email.com"
              autoComplete="email"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
            />
          </div>

          {/* ── Senha ── */}
          <div>
            <div style={inputBox('password', false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused === 'password' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Sua senha"
                autoComplete="current-password"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#555', lineHeight: 1, flexShrink: 0 }}
              >
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginTop: 7 }}>
              <span
                onClick={() => setShowForgot(true)}
                style={{ fontSize: 12, color: '#FFD11A', cursor: 'pointer', fontWeight: 600 }}
              >
                Esqueci a senha
              </span>
            </div>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={!isValid || loading}
            style={{
              height: 56, borderRadius: 14, border: 'none', marginTop: 4,
              background: isValid
                ? 'linear-gradient(135deg, #FFD11A 0%, #FF9500 100%)'
                : '#1A1A1A',
              color: isValid ? '#0F0F0F' : '#444',
              fontSize: 15, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid ? '0 4px 18px rgba(255,209,26,0.25)' : 'none',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <div style={{ width: 18, height: 18, border: '2.5px solid rgba(0,0,0,0.2)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : '→ Entrar'}
          </button>
        </form>

        {/* ── Divider ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#1E1E1E' }} />
          <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: '#1E1E1E' }} />
        </div>

        {/* ── Google ── */}
        <button
          onClick={handleGoogle}
          disabled={gLoading}
          style={{
            width: '100%', height: 56, borderRadius: 14,
            border: '1.5px solid #2E2E2E', background: '#1A1A1A',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A3A'; e.currentTarget.style.background = '#222' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.background = '#1A1A1A' }}
        >
          {gLoading ? (
            <div style={{ width: 18, height: 18, border: '2.5px solid #333', borderTopColor: '#aaa', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : <GoogleIcon />}
          Continuar com Google
        </button>

        {/* ── Register link ── */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#555' }}>
          Não tem conta?{' '}
          <span
            onClick={() => router.push('/cadastro')}
            style={{ color: '#FFD11A', fontWeight: 700, cursor: 'pointer' }}
          >
            Cadastrar grátis
          </span>
        </p>
      </div>

      {/* ── Forgot password modal ── */}
      {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }
        input::placeholder { color: #444; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
