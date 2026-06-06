'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ── Country codes ──────────────────────────────────────────── */
const COUNTRIES = [
  { code: '+55', flag: '🇧🇷', label: 'BR' },
  { code: '+1',  flag: '🇺🇸', label: 'US' },
  { code: '+351',flag: '🇵🇹', label: 'PT' },
  { code: '+54', flag: '🇦🇷', label: 'AR' },
  { code: '+57', flag: '🇨🇴', label: 'CO' },
  { code: '+52', flag: '🇲🇽', label: 'MX' },
  { code: '+34', flag: '🇪🇸', label: 'ES' },
  { code: '+44', flag: '🇬🇧', label: 'GB' },
]

type Step = 'phone' | 'code'

interface Props {
  /** When used inside a modal, called after successful auth instead of redirecting */
  onSuccess?: () => void
  redirectTo?: string
}

const inputBase: React.CSSProperties = {
  background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff',
  fontSize: 15, outline: 'none', width: '100%', height: 52, padding: '0 14px',
  transition: 'border-color 0.15s',
}

function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('provider') || m.includes('disabled') || m.includes('unsupported') || m.includes('not enabled') || m.includes('signups'))
    return 'Login por WhatsApp está sendo ativado. Tente novamente em instantes.'
  if (m.includes('security purposes') || m.includes('rate') || m.includes('wait') || m.includes('after'))
    return 'Aguarde alguns segundos antes de tentar novamente.'
  if (m.includes('invalid') && (m.includes('otp') || m.includes('token')))
    return 'Código inválido. Confira e tente de novo.'
  if (m.includes('expired')) return 'Código expirado. Peça um novo.'
  if (m.includes('network') || m.includes('fetch')) return 'Erro de conexão. Verifique sua internet.'
  if (m.includes('phone')) return 'Número de WhatsApp inválido. Confira o DDD.'
  return 'Não foi possível agora. Tente novamente.'
}

export default function AuthForm({ onSuccess, redirectTo = '/' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step,        setStep]        = useState<Step>('phone')
  const [phone,       setPhone]       = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [code,        setCode]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [countdown,   setCountdown]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`

  function startCountdown() {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(timerRef.current!); return 0 } return prev - 1 })
    }, 1000)
  }

  function validatePhone(v: string) { return v.replace(/\D/g, '').length >= 10 }

  async function sendCode() {
    if (!validatePhone(phone)) { setError('Digite seu WhatsApp com DDD.'); return }
    setError(''); setLoading(true)
    try {
      const { error: sbError } = await supabase.auth.signInWithOtp({ phone: fullPhone })
      if (sbError) throw sbError
      setStep('code'); setCode(''); startCountdown()
    } catch (e) {
      setError(e instanceof Error ? translateError(e.message) : 'Erro ao enviar. Tente novamente.')
    } finally { setLoading(false) }
  }

  async function verify() {
    const token = code.replace(/\D/g, '')
    if (token.length < 6) { setError('Digite o código de 6 dígitos.'); return }
    setError(''); setLoading(true)
    try {
      const { error: sbError } = await supabase.auth.verifyOtp({ phone: fullPhone, token, type: 'sms' })
      if (sbError) throw sbError
      // Garante a linha em public.users (o fluxo de telefone não passa pelo callback).
      // Com timeout para nunca pendurar a UI.
      try {
        const ac = new AbortController()
        const t = setTimeout(() => ac.abort(), 6000)
        await fetch('/api/auth/ensure-user', { method: 'POST', signal: ac.signal }).finally(() => clearTimeout(t))
      } catch { /* não-fatal */ }
      if (onSuccess) onSuccess()
      else { router.push(redirectTo); router.refresh() }
    } catch (e) {
      setError(e instanceof Error ? translateError(e.message) : 'Código inválido. Tente novamente.')
    } finally { setLoading(false) }
  }

  async function handleResend() {
    if (countdown > 0) return
    await sendCode()
  }

  /* ── Tela do CÓDIGO ── */
  if (step === 'code') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 46, marginBottom: 14 }}>💬</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Digite o código</h2>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>
          Enviamos um código no WhatsApp <span style={{ color: '#fff', fontWeight: 600 }}>{fullPhone}</span>.
        </p>

        <input
          type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') verify() }}
          placeholder="000000" autoFocus maxLength={6}
          style={{ ...inputBase, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: '0.5em', paddingLeft: '0.5em' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
          onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
        />

        {error && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</p>}

        <button onClick={verify} disabled={loading || code.length < 6}
          style={{ width: '100%', height: 52, borderRadius: 8, border: 'none', marginTop: 16,
            background: loading || code.length < 6 ? '#1a1a1a' : '#25D366',
            color: loading || code.length < 6 ? '#444' : '#fff',
            fontSize: 15, fontWeight: 800, cursor: loading || code.length < 6 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading
            ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : 'Verificar e entrar'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button onClick={() => { setStep('phone'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            ← Trocar número
          </button>
          <button onClick={handleResend} disabled={countdown > 0}
            style={{ background: 'none', border: 'none', color: countdown > 0 ? '#444' : '#25D366', fontSize: 13, cursor: countdown > 0 ? 'default' : 'pointer', fontWeight: 600 }}>
            {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  /* ── Tela do TELEFONE ── */
  return (
    <form onSubmit={e => { e.preventDefault(); sendCode() }}>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>💬</span> Entre com seu WhatsApp — o código chega lá.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
          style={{ height: 52, background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 13, padding: '0 8px', cursor: 'pointer', outline: 'none', flexShrink: 0 }}>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code} style={{ background: '#111' }}>{c.flag} {c.code}</option>
          ))}
        </select>
        <input
          type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }}
          placeholder="(11) 99999-9999" autoFocus autoComplete="tel"
          style={{ ...inputBase, flex: 1 }}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
          onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
        />
      </div>

      {error && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</p>}

      <button type="submit" disabled={loading}
        style={{ width: '100%', height: 52, borderRadius: 8, border: 'none', marginTop: 16,
          background: loading ? '#1a1a1a' : '#25D366', color: loading ? '#444' : '#fff',
          fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading
          ? <span style={{ width: 18, height: 18, border: '2px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : 'Receber código no WhatsApp'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: 14 }}>
        Sem senha. O código chega no seu WhatsApp.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
