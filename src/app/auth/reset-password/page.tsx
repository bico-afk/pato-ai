'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function getStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pwd) return { level: 0, label: '', color: '' }
  let s = 0
  if (pwd.length >= 8) s++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++
  if (/\d/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  if (s <= 1) return { level: 1, label: 'Fraca', color: '#FF4444' }
  if (s <= 2) return { level: 2, label: 'Média', color: '#FFD11A' }
  return { level: 3, label: 'Forte', color: '#22C55E' }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const strength = getStrength(password)
  const canSubmit = strength.level === 3 && confirm === password && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    const { error: e2 } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (e2) { setError(e2.message); return }
    setDone(true)
    setTimeout(() => router.push('/feed'), 2000)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, color: '#fff', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Senha atualizada!</h2>
        <p style={{ color: '#888', fontSize: 14 }}>Redirecionando…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>Nova senha</h1>
          <p style={{ fontSize: 14, color: '#666' }}>Crie uma senha forte para sua conta</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#FF6B6B' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', height: 56, background: '#1A1A1A', border: '1.5px solid #2E2E2E', borderRadius: 14, padding: '0 16px', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nova senha"
                autoComplete="new-password"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, lineHeight: 1 }}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>

            {password && (
              <div style={{ marginTop: 8, paddingLeft: 2 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {([1, 2, 3] as const).map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength.level ? strength.color : '#2A2A2A', transition: 'background 0.3s' }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: strength.color }}>Senha {strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div style={{ display: 'flex', alignItems: 'center', height: 56, background: '#1A1A1A', border: `1.5px solid ${confirm && confirm !== password ? '#FF4444' : '#2E2E2E'}`, borderRadius: 14, padding: '0 16px', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m9 12 2 2 4-4"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15 }}
            />
          </div>
          {confirm && confirm !== password && (
            <p style={{ fontSize: 11, color: '#FF4444', marginTop: -8, paddingLeft: 4 }}>As senhas não coincidem</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              height: 56, borderRadius: 14, border: 'none', marginTop: 4,
              background: canSubmit ? 'linear-gradient(135deg, #FFD11A, #FF9500)' : '#1A1A1A',
              color: canSubmit ? '#0F0F0F' : '#444',
              fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {loading
              ? <div style={{ width: 18, height: 18, border: '2.5px solid rgba(0,0,0,0.2)', borderTopColor: '#0F0F0F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : '🔑 Salvar nova senha'
            }
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #444; }
      `}</style>
    </div>
  )
}
