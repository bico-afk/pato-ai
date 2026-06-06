'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ── Country codes ──────────────────────────────────────────── */
const COUNTRIES = [
  { code: '+55', flag: '🇧🇷', label: 'BR' },
  { code: '+1',  flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'GB' },
  { code: '+351',flag: '🇵🇹', label: 'PT' },
  { code: '+54', flag: '🇦🇷', label: 'AR' },
  { code: '+57', flag: '🇨🇴', label: 'CO' },
  { code: '+52', flag: '🇲🇽', label: 'MX' },
  { code: '+34', flag: '🇪🇸', label: 'ES' },
]

type Mode = 'email' | 'phone'
type EmailStep = 'input' | 'sent'

interface Props {
  /** When used inside a modal, called after successful auth instead of redirecting */
  onSuccess?: () => void
  redirectTo?: string
}

/* ── Shared input style ─────────────────────────────────────── */
const inputBase: React.CSSProperties = {
  background: '#111',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  fontSize: 15,
  outline: 'none',
  width: '100%',
  height: 52,
  padding: '0 14px',
  transition: 'border-color 0.15s',
}

/* ── Error translation ──────────────────────────────────────── */
function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('security purposes') || m.includes('after') || m.includes('rate') || m.includes('wait'))
    return 'Aguarde alguns segundos antes de tentar novamente.'
  if (m.includes('invalid login') || m.includes('invalid email') || m.includes('invalid otp') || m.includes('invalid token'))
    return 'Email ou código inválido.'
  if (m.includes('expired'))
    return 'Link expirado. Solicite um novo.'
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Esse email já está cadastrado.'
  if (m.includes('email not confirmed'))
    return 'Email ainda não confirmado. Verifique sua caixa de entrada.'
  if (m.includes('phone') && m.includes('invalid'))
    return 'Número de telefone inválido.'
  if (m.includes('sms') || m.includes('otp'))
    return 'Erro ao enviar SMS. Verifique o número e tente novamente.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet.'
  return 'Erro ao entrar. Tente novamente.'
}

export default function AuthForm({ onSuccess, redirectTo = '/' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [mode,        setMode]        = useState<Mode>('email')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [emailStep,   setEmailStep]   = useState<EmailStep>('input')
  const [code,        setCode]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [countdown,   setCountdown]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown() {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }

  function validatePhone(v: string) {
    return v.replace(/\D/g, '').length >= 8
  }

  async function handleEmailSubmit() {
    if (!validateEmail(email)) { setError('Email inválido'); return }
    setError(''); setLoading(true)
    try {
      const { error: sbError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          // mantém o link como alternativa; o código (token) vem no mesmo e-mail
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      })
      if (sbError) throw sbError
      setEmailStep('sent')
      setCode('')
      startCountdown()
    } catch (e) {
      setError(e instanceof Error ? translateError(e.message) : 'Erro ao enviar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    const token = code.replace(/\s/g, '')
    if (token.length < 6) { setError('Digite o código de 6 dígitos.'); return }
    setError(''); setLoading(true)
    try {
      const { error: sbError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (sbError) throw sbError
      if (onSuccess) onSuccess()
      else { router.push(redirectTo); router.refresh() }
    } catch (e) {
      setError(e instanceof Error ? translateError(e.message) : 'Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhoneSubmit() {
    if (!validatePhone(phone)) { setError('Telefone inválido'); return }
    setError(''); setLoading(true)
    const full = `${countryCode}${phone.replace(/\D/g, '')}`
    try {
      const { error: sbError } = await supabase.auth.signInWithOtp({ phone: full })
      if (sbError) throw sbError
      router.push(`/auth/verify?phone=${encodeURIComponent(full)}&next=${encodeURIComponent(redirectTo)}`)
    } catch (e) {
      setError(e instanceof Error ? translateError(e.message) : 'Erro ao enviar SMS. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (countdown > 0) return
    if (mode === 'email') {
      await handleEmailSubmit()   // reenvia um novo código
    } else {
      await handlePhoneSubmit()
      startCountdown()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'email') handleEmailSubmit()
    else handlePhoneSubmit()
  }

  /* ── Tab button ── */
  function Tab({ value, label }: { value: Mode; label: string }) {
    const active = mode === value
    return (
      <button
        type="button"
        onClick={() => { setMode(value); setError('') }}
        style={{
          flex: 1, height: 40, borderRadius: 6, border: 'none',
          background: active ? '#fff' : 'transparent',
          color: active ? '#000' : '#555',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    )
  }

  /* ── Email code screen ── */
  if (emailStep === 'sent') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          Digite o código
        </h2>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 22 }}>
          Enviamos um código de 6 dígitos para <span style={{ color: '#fff', fontWeight: 600 }}>{email}</span>.
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') handleVerifyCode() }}
          placeholder="000000"
          autoFocus
          maxLength={6}
          style={{
            ...inputBase, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 800,
            letterSpacing: '0.5em', paddingRight: 0, paddingLeft: '0.5em',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
          onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
        />

        {error && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</p>}

        <button
          onClick={handleVerifyCode}
          disabled={loading || code.length < 6}
          style={{
            width: '100%', height: 52, borderRadius: 8, border: 'none', marginTop: 16,
            background: loading || code.length < 6 ? '#1a1a1a' : '#fff',
            color: loading || code.length < 6 ? '#444' : '#000',
            fontSize: 15, fontWeight: 800, cursor: loading || code.length < 6 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading
            ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            : 'Verificar e entrar'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button onClick={() => { setEmailStep('input'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            ← Trocar email
          </button>
          <button onClick={handleResend} disabled={countdown > 0}
            style={{ background: 'none', border: 'none', color: countdown > 0 ? '#444' : '#00d4ff', fontSize: 13, cursor: countdown > 0 ? 'default' : 'pointer', fontWeight: 600 }}>
            {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Mode tabs */}
      <div style={{
        display: 'flex', background: '#111', border: '1px solid #222',
        borderRadius: 8, padding: 4, marginBottom: 24,
      }}>
        <Tab value="email"  label="Email" />
        <Tab value="phone"  label="Telefone" />
      </div>

      {/* Email input */}
      {mode === 'email' && (
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoFocus
          autoComplete="email"
          style={inputBase}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
          onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
        />
      )}

      {/* Phone input */}
      {mode === 'phone' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            style={{
              height: 52, background: '#111', border: '1px solid #333',
              borderRadius: 8, color: '#fff', fontSize: 13,
              padding: '0 8px', cursor: 'pointer', outline: 'none',
              flexShrink: 0,
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code} style={{ background: '#111' }}>
                {c.flag} {c.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            autoFocus
            autoComplete="tel"
            style={{ ...inputBase, flex: 1 }}
            onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', height: 52, borderRadius: 8, border: 'none',
          background: loading ? '#1a1a1a' : '#fff',
          color: loading ? '#444' : '#000',
          fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
          marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {loading ? (
          <span style={{
            width: 18, height: 18, border: '2px solid #333', borderTopColor: '#fff',
            borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : 'Entrar'}
      </button>

      {/* Tagline */}
      <p style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: 14 }}>
        Sem senha. Sem complicação.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
