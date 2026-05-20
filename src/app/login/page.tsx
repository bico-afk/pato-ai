'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ── helpers ─────────────────────────────────────────────── */
function friendlyErr(m: string) {
  if (m.includes('Email not confirmed') || m.includes('email_not_confirmed'))
    return 'E-mail não confirmado. Verifique sua caixa de entrada.'
  if (m.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.'
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit'))
    return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('provider is not enabled'))
    return 'Login com Google não está ativado ainda.'
  if (m.includes('User not found'))
    return 'Nenhuma conta com esse e-mail.'
  return m
}

/* ── icons ───────────────────────────────────────────────── */
const IconMail  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
const IconLock  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconEye   = ({ open }: { open: boolean }) => open
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IconGoogle = () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
const IconX     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

/* ── decorative duck ─────────────────────────────────────── */
const DuckBg = () => (
  <svg viewBox="0 0 360 360" fill="white" style={{ position:'absolute', left:-40, bottom:20, width:320, opacity:0.04, pointerEvents:'none', userSelect:'none', zIndex:0 }}>
    <ellipse cx="175" cy="265" rx="145" ry="90"/>
    <circle cx="265" cy="80" r="62"/>
    <path d="M240 130 Q278 170 268 220"/>
    <path d="M320 68 L362 58 L364 88 L322 86 Z"/>
    <path d="M30 235 Q8 262 20 300 L58 278 Q44 254 56 235 Z"/>
    <path d="M100 268 Q175 235 250 268" stroke="white" strokeWidth="9" fill="none" strokeLinecap="round"/>
  </svg>
)

/* ── glow helpers ────────────────────────────────────────── */
function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#FFD11A'
  e.target.style.boxShadow   = '0 0 0 3px rgba(255,209,26,0.12)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#272727'
  e.target.style.boxShadow   = 'none'
}

/* ── modal esqueceu senha ────────────────────────────────── */
function ForgotModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [email,  setEmail]  = useState('')
  const [load,   setLoad]   = useState(false)
  const [msg,    setMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setLoad(true); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })
    setLoad(false)
    if (error) setMsg({ ok:false, text: 'Erro ao enviar. Verifique o e-mail e tente novamente.' })
    else        setMsg({ ok:true,  text: 'Link enviado! Verifique sua caixa de entrada e spam.' })
  }

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380, backgroundColor:'#111', border:'1px solid #222', borderRadius:20, padding:28, position:'relative' }}>
        {/* close */}
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#444', cursor:'pointer', display:'flex', padding:4, borderRadius:8 }}>
          <IconX />
        </button>

        <h3 style={{ margin:'0 0 6px', fontSize:20, fontWeight:900, color:'#fff' }}>Esqueceu a senha?</h3>
        <p style={{ margin:'0 0 22px', fontSize:13, color:'#555', lineHeight:1.5 }}>
          Digite seu e-mail e enviaremos um link para você criar uma nova senha.
        </p>

        {msg && (
          <div style={{ padding:'12px 14px', borderRadius:10, marginBottom:16,
            backgroundColor: msg.ok ? '#0a1f12' : '#1f0707',
            border:`1px solid ${msg.ok ? '#1a5c33' : '#5c1111'}`,
            color: msg.ok ? '#4ade80' : '#f87171', fontSize:13, lineHeight:1.5 }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={send} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#444', display:'flex', pointerEvents:'none' }}><IconMail /></span>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com" required
              style={{ width:'100%', boxSizing:'border-box', height:52, backgroundColor:'#171717', border:'1.5px solid #272727', borderRadius:12, paddingLeft:46, paddingRight:14, color:'#fff', fontSize:14, outline:'none', transition:'border-color 0.15s, box-shadow 0.15s', fontFamily:'inherit' }}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>
          <button type="submit" disabled={load || !!msg?.ok} style={{
            height:52, borderRadius:12, border:'none',
            backgroundColor: (load || msg?.ok) ? '#1a1800' : '#FFD11A',
            color: (load || msg?.ok) ? '#444' : '#000',
            fontSize:14, fontWeight:700, cursor: load ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow: (!load && !msg?.ok) ? '0 4px 16px rgba(255,209,26,0.2)' : 'none',
          }}>
            {load
              ? <><span style={{ width:16, height:16, border:'2px solid #0003', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/> enviando…</>
              : msg?.ok ? '✓ Link enviado!' : 'Enviar link de recuperação →'
            }
          </button>
        </form>

        {msg?.ok && (
          <button onClick={onClose} style={{ marginTop:12, width:'100%', height:44, borderRadius:12, border:'1px solid #222', backgroundColor:'transparent', color:'#aaa', fontSize:13, cursor:'pointer' }}>
            Voltar ao login
          </button>
        )}
      </div>
    </div>
  )
}

/* ── login form ──────────────────────────────────────────── */
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [email,    setEmail]   = useState('')
  const [pwd,      setPwd]     = useState('')
  const [showPwd,  setShow]    = useState(false)
  const [load,     setLoad]    = useState(false)
  const [gLoad,    setGLoad]   = useState(false)
  const [err,      setErr]     = useState<string | null>(
    searchParams.get('error') ? 'Falha na autenticação. Tente novamente.' : null
  )
  const [notConf,  setNotConf] = useState(false)
  const [showForgot, setForgot] = useState(false)

  const inp: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', height:56,
    backgroundColor:'#171717', border:'1.5px solid #272727', borderRadius:14,
    paddingLeft:46, paddingRight:16, color:'#fff', fontSize:15, outline:'none',
    transition:'border-color 0.15s, box-shadow 0.15s', fontFamily:'inherit',
  }

  async function afterLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/feed'); return }
    // Verificar se completou onboarding (city preenchida = completou)
    const { data: prof } = await supabase.from('profiles').select('city, type').eq('id', user.id).single()
    if (!prof?.city) {
      router.push('/onboarding')
    } else {
      router.push('/feed')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoad(true); setErr(null); setNotConf(false)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pwd,
    })
    setLoad(false)

    if (error) {
      setNotConf(error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed'))
      setErr(friendlyErr(error.message))
    } else {
      await afterLogin()
    }
  }

  async function handleResend() {
    await supabase.auth.resend({ type:'signup', email: email.trim().toLowerCase() })
    setErr('E-mail de confirmação reenviado! Verifique também o spam.')
    setNotConf(false)
  }

  async function handleGoogle() {
    setGLoad(true); setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo:`${window.location.origin}/auth/callback` },
    })
    if (error) { setGLoad(false); setErr(friendlyErr(error.message)) }
  }

  return (
    <>
      {showForgot && <ForgotModal onClose={() => setForgot(false)} />}

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
            <Link href="/cadastro" style={{ color:'#444', fontSize:13, textDecoration:'none' }}>criar conta →</Link>
          </div>

          {/* ── hero ── */}
          <div style={{ padding:'28px 24px 0', position:'relative', zIndex:1 }}>
            <p style={{ color:'#FFD11A', fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', margin:'0 0 12px' }}>
              · Entrar ·
            </p>
            <h1 style={{ margin:'0 0 10px', lineHeight:1.05 }}>
              <span style={{ display:'block', fontSize:38, fontWeight:900, color:'#fff', letterSpacing:'-1.5px' }}>Bem-vindo</span>
              <span style={{ display:'block', fontSize:38, fontWeight:900, color:'#FFD11A', letterSpacing:'-1.5px', fontStyle:'italic' }}>de volta. 👋</span>
            </h1>
            <p style={{ color:'#555', fontSize:14, lineHeight:1.6, margin:'0 0 28px' }}>
              Sentimos sua falta. O bando está te esperando.
            </p>
          </div>

          {/* ── form ── */}
          <form onSubmit={handleLogin} style={{ padding:'0 24px', display:'flex', flexDirection:'column', gap:16, position:'relative', zIndex:1 }}>

            {/* error */}
            {err && (
              <div style={{ padding:'13px 16px', borderRadius:12, backgroundColor:'#1f0707', border:'1.5px solid #5c1111', color:'#f87171', fontSize:13, lineHeight:1.5 }}>
                ⚠️ {err}
                {notConf && (
                  <button type="button" onClick={handleResend}
                    style={{ display:'block', marginTop:8, background:'none', border:'1px solid #FFD11A44', borderRadius:8, color:'#FFD11A', fontSize:12, fontWeight:600, padding:'6px 12px', cursor:'pointer' }}>
                    Reenviar e-mail de confirmação
                  </button>
                )}
              </div>
            )}

            {/* email */}
            <div>
              <label style={{ display:'block', color:'#555', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>E-mail</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#444', display:'flex', pointerEvents:'none' }}><IconMail /></span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com" required
                  style={inp} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* senha */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                <label style={{ color:'#555', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Senha</label>
                <button type="button" onClick={() => setForgot(true)}
                  style={{ background:'none', border:'none', color:'#444', fontSize:12, cursor:'pointer', padding:0, transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#FFD11A')}
                  onMouseLeave={e => (e.currentTarget.style.color='#444')}>
                  Esqueci a senha
                </button>
              </div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#444', display:'flex', pointerEvents:'none' }}><IconLock /></span>
                <input type={showPwd ? 'text' : 'password'} value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="sua senha" required
                  style={{ ...inp, paddingRight:50 }}
                  onFocus={onFocus} onBlur={onBlur} />
                <button type="button" onClick={() => setShow(v => !v)}
                  style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#444', cursor:'pointer', display:'flex', padding:0 }}>
                  <IconEye open={showPwd} />
                </button>
              </div>
            </div>

            {/* submit */}
            <button type="submit" disabled={load} style={{
              height:56, width:'100%', borderRadius:14, border:'none',
              backgroundColor: load ? '#b89a12' : '#FFD11A',
              color:'#0F0F0F', fontSize:16, fontWeight:800,
              cursor: load ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'all 0.2s', marginTop:4,
              boxShadow: load ? 'none' : '0 4px 24px rgba(255,209,26,0.25)',
              letterSpacing:'-0.2px',
            }}>
              {load
                ? <><span style={{ width:18, height:18, border:'2px solid #0003', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/> entrando…</>
                : 'Entrar →'
              }
            </button>
          </form>

          {/* ── divider ── */}
          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 24px', position:'relative', zIndex:1 }}>
            <div style={{ flex:1, height:1, backgroundColor:'#1e1e1e' }}/>
            <span style={{ color:'#333', fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>ou continue com</span>
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

          {/* ── footer ── */}
          <div style={{ textAlign:'center', padding:'28px 24px 40px', position:'relative', zIndex:1 }}>
            <p style={{ margin:0, color:'#444', fontSize:14 }}>
              Não tem conta?{' '}
              <Link href="/cadastro" style={{ color:'#FFD11A', fontWeight:700, textDecoration:'none' }}>
                Cadastrar grátis →
              </Link>
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        input::placeholder { color: #333 }
      `}</style>
    </>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
