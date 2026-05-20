'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ── helpers ─────────────────────────────────────────────── */
function pwStrength(p: string): 0|1|2|3 {
  if (!p) return 0
  if (p.length < 6) return 1
  if (p.length >= 10 && /[A-Z]/.test(p) && /[0-9!@#$%]/.test(p)) return 3
  return 2
}
function validEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
function friendlyErr(m: string) {
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('already registered') || m.includes('User already registered')) return 'Este e-mail já está cadastrado. Tente fazer login.'
  if (m.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (m.includes('Unable to validate email')) return 'E-mail inválido. Verifique e tente novamente.'
  if (m.includes('provider is not enabled')) return 'Login com Google não está ativado ainda.'
  if (m.includes('Signups not allowed')) return 'Cadastros desabilitados temporariamente.'
  return m
}

/* ── icons ───────────────────────────────────────────────── */
const IconUser  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
const IconMail  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
const IconLock  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconEye   = ({ open }: { open: boolean }) => open
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IconGoogle = () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>

/* ── decorative duck ─────────────────────────────────────── */
const DuckBg = () => (
  <svg viewBox="0 0 360 360" fill="white" style={{ position:'absolute', right:-60, bottom:40, width:340, opacity:0.04, pointerEvents:'none', userSelect:'none', zIndex:0 }}>
    <ellipse cx="175" cy="265" rx="145" ry="90"/>
    <circle cx="265" cy="80" r="62"/>
    <path d="M240 130 Q278 170 268 220"/>
    <path d="M320 68 L362 58 L364 88 L322 86 Z"/>
    <path d="M30 235 Q8 262 20 300 L58 278 Q44 254 56 235 Z"/>
    <path d="M100 268 Q175 235 250 268" stroke="white" strokeWidth="9" fill="none" strokeLinecap="round"/>
  </svg>
)

/* ── strength bar ────────────────────────────────────────── */
const S_LABEL = ['','FRACA','MÉDIA','FORTE'] as const
const S_COLOR = ['','#FF4D6A','#FFD11A','#22C55E'] as const
const StrengthBar = ({ lvl }: { lvl: 0|1|2|3 }) => {
  if (!lvl) return null
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', gap:5 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:4, backgroundColor: i<=lvl ? S_COLOR[lvl] : '#222', transition:'background-color 0.25s' }}/>
        ))}
      </div>
      <p style={{ margin:'5px 0 0', color:S_COLOR[lvl], fontSize:11, fontWeight:700, letterSpacing:'0.08em', textAlign:'right' }}>
        SENHA {S_LABEL[lvl]}
      </p>
    </div>
  )
}

/* ── field wrapper ───────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', color:'#555', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>{label}</label>
      {children}
    </div>
  )
}

/* ── main ────────────────────────────────────────────────── */
export default function CadastroPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [name,       setName]    = useState('')
  const [email,      setEmail]   = useState('')
  const [emailBlur,  setEB]      = useState(false)
  const [pwd,        setPwd]     = useState('')
  const [showPwd,    setShow]    = useState(false)
  const [agreed,     setAgreed]  = useState(false)
  const [loading,    setLoad]    = useState(false)
  const [gLoad,      setGLoad]   = useState(false)
  const [err,        setErr]     = useState<string|null>(null)
  const [done,       setDone]    = useState(false)

  const strength  = pwStrength(pwd)
  const emailErr  = emailBlur && email.length > 0 && !validEmail(email)
  const canSubmit = name.trim() && validEmail(email) && pwd.length >= 6 && agreed && !loading

  /* input base style */
  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width:'100%', boxSizing:'border-box', height:56,
    backgroundColor:'#171717', border:'1.5px solid #272727',
    borderRadius:14, color:'#fff', fontSize:15, outline:'none',
    paddingLeft:46, paddingRight:16,
    transition:'border-color 0.15s, box-shadow 0.15s',
    fontFamily:'inherit',
    ...extra,
  })

  function focusGlow(e: React.FocusEvent<HTMLInputElement>, isErr = false) {
    e.target.style.borderColor = isErr ? '#FF4D6A' : '#FFD11A'
    e.target.style.boxShadow   = isErr ? '0 0 0 3px rgba(255,77,106,0.12)' : '0 0 0 3px rgba(255,209,26,0.12)'
  }
  function blurReset(e: React.FocusEvent<HTMLInputElement>, isErr = false) {
    e.target.style.borderColor = isErr ? '#FF4D6A' : '#272727'
    e.target.style.boxShadow   = 'none'
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoad(true); setErr(null)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pwd,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoad(false)
    if (error) { setErr(friendlyErr(error.message)); return }
    if (!data.user) { setErr('Este e-mail já pode estar cadastrado. Tente fazer login.'); return }
    if (data.session) { router.push('/onboarding'); return }
    setDone(true)
  }

  async function handleGoogle() {
    setGLoad(true); setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo:`${window.location.origin}/auth/callback` },
    })
    if (error) { setGLoad(false); setErr(friendlyErr(error.message)) }
  }

  /* ── success state ── */
  if (done) return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ maxWidth:420, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🦆</div>
        <h2 style={{ color:'#fff', fontSize:24, fontWeight:900, margin:'0 0 10px' }}>Conta criada!</h2>
        <p style={{ color:'#666', fontSize:14, lineHeight:1.6, margin:'0 0 28px' }}>
          Verifique seu e-mail <strong style={{ color:'#fff' }}>{email}</strong> para confirmar o cadastro.
        </p>
        <Link href="/login" style={{ display:'inline-block', height:52, lineHeight:'52px', borderRadius:14, backgroundColor:'#FFD11A', color:'#000', fontWeight:700, fontSize:15, padding:'0 32px', textDecoration:'none' }}>
          Ir para o login →
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ backgroundColor:'#0F0F0F', minHeight:'100vh', display:'flex', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        <DuckBg />

        {/* ── header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Image src="/pato-icon.svg" alt="pato" width={26} height={26} />
            <span style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-0.5px' }}>
              pato<span style={{ color:'#FFD11A' }}>.ai</span>
            </span>
          </div>
          <Link href="/login" style={{ color:'#444', fontSize:13, textDecoration:'none' }}>entrar →</Link>
        </div>

        {/* ── hero ── */}
        <div style={{ padding:'28px 24px 0', position:'relative', zIndex:1 }}>
          <p style={{ color:'#FFD11A', fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', margin:'0 0 12px' }}>
            · Grátis para sempre ·
          </p>
          <h1 style={{ margin:'0 0 10px', lineHeight:1.05 }}>
            <span style={{ display:'block', fontSize:38, fontWeight:900, color:'#fff', letterSpacing:'-1.5px' }}>Bem-vindo</span>
            <span style={{ display:'block', fontSize:38, fontWeight:900, color:'#FFD11A', letterSpacing:'-1.5px', fontStyle:'italic' }}>ao bando. 🦆</span>
          </h1>
          <p style={{ color:'#555', fontSize:14, lineHeight:1.6, margin:'0 0 28px' }}>
            Posta o que precisa. Encontra quem resolve.<br />Em menos de 1 minuto.
          </p>
        </div>

        {/* ── form ── */}
        <form onSubmit={handleSignUp} style={{ padding:'0 24px', display:'flex', flexDirection:'column', gap:16, position:'relative', zIndex:1 }}>

          {/* error banner */}
          {err && (
            <div style={{ padding:'13px 16px', borderRadius:12, backgroundColor:'#1f0707', border:'1.5px solid #5c1111', color:'#f87171', fontSize:13, lineHeight:1.5 }}>
              ⚠️ {err}
            </div>
          )}

          {/* nome */}
          <Field label="Nome completo">
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#444', display:'flex', pointerEvents:'none' }}><IconUser /></span>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="como podemos te chamar?"
                required style={inp()}
                onFocus={e => focusGlow(e)}
                onBlur={e => blurReset(e)}
              />
            </div>
          </Field>

          {/* email */}
          <Field label="E-mail">
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color: emailErr ? '#FF4D6A' : '#444', display:'flex', pointerEvents:'none' }}><IconMail /></span>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={e => { setEB(true); blurReset(e, emailErr) }}
                placeholder="seuemail@exemplo.com"
                required
                style={inp({ borderColor: emailErr ? '#FF4D6A' : '#272727' })}
                onFocus={e => focusGlow(e, emailErr)}
              />
            </div>
            {emailErr && <p style={{ color:'#FF4D6A', fontSize:12, margin:'5px 0 0 4px', fontWeight:600 }}>⚠ E-mail inválido</p>}
          </Field>

          {/* senha */}
          <Field label="Senha">
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#444', display:'flex', pointerEvents:'none' }}><IconLock /></span>
              <input
                type={showPwd ? 'text' : 'password'} value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="mínimo 6 caracteres"
                required minLength={6}
                style={inp({ paddingRight:50 })}
                onFocus={e => focusGlow(e)}
                onBlur={e => blurReset(e)}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#444', cursor:'pointer', display:'flex', padding:0 }}>
                <IconEye open={showPwd} />
              </button>
            </div>
            <StrengthBar lvl={strength} />
          </Field>

          {/* termos */}
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', userSelect:'none' }}>
            <div onClick={() => setAgreed(v => !v)} style={{
              width:20, height:20, minWidth:20, borderRadius:6, marginTop:1,
              backgroundColor: agreed ? '#FFD11A' : 'transparent',
              border:`2px solid ${agreed ? '#FFD11A' : '#333'}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.15s', cursor:'pointer', flexShrink:0,
            }}>
              {agreed && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ color:'#555', fontSize:13, lineHeight:1.5 }}>
              Aceito os{' '}
              <Link href="/termos" style={{ color:'#FFD11A', textDecoration:'none', fontWeight:600 }}>termos de uso</Link>
              {' '}e a{' '}
              <Link href="/privacidade" style={{ color:'#FFD11A', textDecoration:'none', fontWeight:600 }}>política de privacidade</Link>
            </span>
          </label>

          {/* submit */}
          <button type="submit" disabled={!canSubmit} style={{
            height:56, width:'100%', borderRadius:14, border:'none',
            backgroundColor: canSubmit ? '#FFD11A' : '#191700',
            color: canSubmit ? '#0F0F0F' : '#3a3800',
            fontSize:16, fontWeight:800,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            transition:'all 0.2s',
            boxShadow: canSubmit ? '0 4px 24px rgba(255,209,26,0.25)' : 'none',
            letterSpacing:'-0.2px',
          }}>
            {loading
              ? <><span style={{ width:18, height:18, border:'2px solid #0003', borderTopColor:'#000', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/> criando conta…</>
              : 'Criar conta →'
            }
          </button>
        </form>

        {/* ── divider ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 24px', position:'relative', zIndex:1 }}>
          <div style={{ flex:1, height:1, backgroundColor:'#1e1e1e' }}/>
          <span style={{ color:'#333', fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>ou</span>
          <div style={{ flex:1, height:1, backgroundColor:'#1e1e1e' }}/>
        </div>

        {/* ── google ── */}
        <div style={{ padding:'0 24px', position:'relative', zIndex:1 }}>
          <button type="button" onClick={handleGoogle} disabled={gLoad} style={{
            height:56, width:'100%', borderRadius:14,
            backgroundColor:'#171717', border:'1.5px solid #272727',
            color:'#fff', fontSize:14, fontWeight:600,
            cursor: gLoad ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            transition:'border-color 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#444'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#272727'; e.currentTarget.style.boxShadow='none' }}>
            <IconGoogle />
            {gLoad ? 'redirecionando…' : 'Continuar com Google'}
          </button>
        </div>

        {/* ── footer link ── */}
        <div style={{ textAlign:'center', padding:'28px 24px 40px', position:'relative', zIndex:1 }}>
          <p style={{ margin:0, color:'#444', fontSize:14 }}>
            Já tem conta?{' '}
            <Link href="/login" style={{ color:'#FFD11A', fontWeight:700, textDecoration:'none' }}>Entrar →</Link>
          </p>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        input::placeholder { color: #333 }
      `}</style>
    </div>
  )
}
