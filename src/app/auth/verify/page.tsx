'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function VerifyForm() {
  const router = useRouter()
  const params = useSearchParams()
  const phone = params.get('phone') ?? ''
  const next  = params.get('next')  ?? '/'

  const supabase = createClient()
  const [digits,    setDigits]    = useState(['', '', '', '', '', ''])
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs   = useRef<(HTMLInputElement | null)[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    inputRefs.current[0]?.focus()
    startCountdown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startCountdown() {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function submitOtp(code: string) {
    setError(''); setLoading(true)
    try {
      const { error: sbError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      })
      if (sbError) {
        const msg = sbError.message.includes('expired')
          ? 'Código expirado. Reenvie um novo.'
          : sbError.message.includes('invalid')
          ? 'Código incorreto. Verifique e tente novamente.'
          : 'Erro ao verificar. Tente novamente.'
        setError(msg)
        setDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        router.push(next)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)
    setError('')

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit on last digit
    if (index === 5 && digit) {
      const code = [...newDigits.slice(0, 5), digit].join('')
      if (code.length === 6) submitOtp(code)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const arr = pasted.split('')
      setDigits(arr)
      inputRefs.current[5]?.focus()
      submitOtp(pasted)
    }
  }

  async function handleResend() {
    if (countdown > 0 || !phone) return
    setError('')
    try {
      await supabase.auth.signInWithOtp({ phone })
      startCountdown()
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch {
      setError('Erro ao reenviar. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: 48, height: 58, borderRadius: 10,
    background: '#111', border: '1px solid #333',
    color: '#fff', fontSize: 24, fontWeight: 700,
    textAlign: 'center', outline: 'none',
    transition: 'border-color 0.15s',
    caretColor: '#00d4ff',
  }

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 32, lineHeight: 1.6 }}>
        Enviamos um código para{' '}
        <span style={{ color: '#fff', fontWeight: 600 }}>{phone}</span>
      </p>

      {/* 6-digit inputs */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#00d4ff')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#333')}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{
            width: 22, height: 22, border: '2px solid #333', borderTopColor: '#00d4ff',
            borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}

      {/* Resend */}
      <p style={{ textAlign: 'center', fontSize: 13, color: '#444' }}>
        Não recebeu?{' '}
        <button
          onClick={handleResend}
          disabled={countdown > 0}
          style={{
            background: 'none', border: 'none',
            color: countdown > 0 ? '#444' : '#00d4ff',
            fontSize: 13, fontWeight: 600,
            cursor: countdown > 0 ? 'default' : 'pointer',
            padding: 0,
          }}
        >
          {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
        </button>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function VerifyPage() {
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

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: '#0f0f0f', border: '1px solid #1e1e1e',
          borderRadius: 16, padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📱</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>
            Digite o código
          </h1>

          <Suspense fallback={<div style={{ color: '#555', fontSize: 14 }}>Carregando...</div>}>
            <VerifyForm />
          </Suspense>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #1a1a1a' }}>
            <Link href="/auth" style={{ fontSize: 13, color: '#444', textDecoration: 'none' }}>
              ← Usar outro método
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
