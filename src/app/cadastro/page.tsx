'use client'

import { useState, useId, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image                from 'next/image'
import { createClient }     from '@/lib/supabase'

/* ─── Password strength ──────────────────────────────────── */
type StrengthLevel = 0 | 1 | 2 | 3

function getStrength(pwd: string): { level: StrengthLevel; label: string; color: string } {
  if (!pwd) return { level: 0, label: '', color: '' }
  let s = 0
  if (pwd.length >= 8)                              s++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd))      s++
  if (/\d/.test(pwd))                               s++
  if (/[^A-Za-z0-9]/.test(pwd))                    s++
  if (s <= 1) return { level: 1, label: 'Fraca',  color: '#FF4444' }
  if (s <= 2) return { level: 2, label: 'Média',  color: '#FFD11A' }
  return             { level: 3, label: 'Forte',  color: '#22C55E' }
}

/* ─── Google SVG icon ─────────────────────────────────────── */
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

/* ─── Page ────────────────────────────────────────────────── */
function CadastroContent() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const pendingQuery  = searchParams.get('q') ?? ''
  const checkId       = useId()

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [agreed,      setAgreed]      = useState(false)
  const [focused,     setFocused]     = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [gLoading,    setGLoading]    = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [emailError,  setEmailError]  = useState('')
  const [nameError,   setNameError]   = useState('')

  const strength = getStrength(password)
  const isValid  = strength.level === 3 && agreed && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email)

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

  function validateEmail() {
    if (email && !/\S+@\S+\.\S+/.test(email)) setEmailError('E-mail inválido')
    else setEmailError('')
  }

  function validateName() {
    if (name && name.trim().length < 2) setNameError('Nome muito curto')
    else setNameError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || loading) return
    setError('')
    setLoading(true)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data:       { full_name: name.trim() },
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined,
      },
    })

    if (signUpError) {
      setLoading(false)
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setError('Este e-mail já está cadastrado. Tente fazer login.')
      } else {
        setError(signUpError.message)
      }
      return
    }

    if (data.session) {
      // Auto-confirm enabled — go to resultados if came from search, else onboarding
      router.push(pendingQuery ? `/resultados?q=${encodeURIComponent(pendingQuery)}` : '/resultados')
    } else {
      // Email confirmation required
      setSuccess(true)
      setLoading(false)
    }
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
    // Redirect handled by Supabase — no need to setGLoading(false)
  }

  /* ── Email sent success state ── */
  if (success) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'Inter, sans-serif', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>📬</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Verifique seu e-mail</h2>
        <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, maxWidth: 320, marginBottom: 32 }}>
          Enviamos um link de confirmação para<br />
          <span style={{ color: '#FFD11A', fontWeight: 600 }}>{email}</span>
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{ height: 50, borderRadius: 14, border: 'none', background: '#FFD11A', color: '#0F0F0F', fontWeight: 800, cursor: 'pointer', padding: '0 28px', fontSize: 14 }}
        >
          Ir para o Login
        </button>
      </div>
    )
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

      {/* Content box */}
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Banner de busca pendente */}
        {pendingQuery && (
          <div style={{
            background: 'rgba(255,209,26,0.08)', border: '1px solid rgba(255,209,26,0.2)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: '#FFD11A',
          }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span>
              Cadastre-se para ver resultados de{' '}
              <strong>&quot;{pendingQuery}&quot;</strong>
            </span>
          </div>
        )}

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
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Crie sua conta
          </h1>
          <p style={{ fontSize: 14, color: '#FFD11A', fontWeight: 600, fontStyle: 'italic', margin: 0 }}>
            Grátis para sempre
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Nome completo ── */}
          <div>
            <div style={inputBox('name', !!nameError)}>
              {/* Person icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused === 'name' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setFocused('name')}
                onBlur={() => { setFocused(null); validateName() }}
                placeholder="Nome completo"
                autoComplete="name"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
              />
            </div>
            {nameError && <p style={{ fontSize: 11, color: '#E24B4A', margin: '5px 0 0 4px' }}>{nameError}</p>}
          </div>

          {/* ── E-mail ── */}
          <div>
            <div style={inputBox('email', !!emailError)}>
              {/* Envelope icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focused === 'email' ? '#FFD11A' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => { setFocused(null); validateEmail() }}
                placeholder="seu@email.com"
                autoComplete="email"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
              />
            </div>
            {emailError && <p style={{ fontSize: 11, color: '#E24B4A', margin: '5px 0 0 4px' }}>{emailError}</p>}
          </div>

          {/* ── Senha ── */}
          <div>
            <div style={inputBox('password', false)}>
              {/* Lock icon */}
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
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
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

            {/* Strength meter */}
            {password && (
              <div style={{ marginTop: 8, paddingLeft: 2 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {([1, 2, 3] as StrengthLevel[]).map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 99,
                      background: i <= strength.level ? strength.color : '#2A2A2A',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: strength.color }}>
                  Senha {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* ── Checkbox termos ── */}
          <label
            htmlFor={checkId}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 4 }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${agreed ? '#FFD11A' : '#2E2E2E'}`,
              background: agreed ? '#FFD11A' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {agreed && <span style={{ color: '#0F0F0F', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>✓</span>}
            </div>
            <input
              id={checkId}
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <span style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
              Aceito os{' '}
              <span style={{ color: '#FFD11A', cursor: 'pointer' }}>termos de uso</span>
              {' '}e{' '}
              <span style={{ color: '#FFD11A', cursor: 'pointer' }}>política de privacidade</span>
            </span>
          </label>

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
            ) : '🎉 Criar conta grátis'}
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

        {/* ── Login link ── */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#555' }}>
          Já tem conta?{' '}
          <span
            onClick={() => router.push('/login')}
            style={{ color: '#FFD11A', fontWeight: 700, cursor: 'pointer' }}
          >
            Entrar
          </span>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #444; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CadastroContent />
    </Suspense>
  )
}
