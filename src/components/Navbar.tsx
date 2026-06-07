'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import BikcoDuck from '@/components/landing/BikcoDuck'
import Flag from '@/components/landing/Flag'
import { useLang } from '@/components/Lang/LangProvider'
import { LANGS } from '@/lib/landing/i18n'

const initials = (n: string) =>
  (n ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'

/* Pages that have their own full-screen headers — hide navbar on these */
const HEADERLESS = ['/auth', '/onboarding']

export default function Navbar() {
  const { isAuthenticated, profile, loading, signOut } = useAuth()
  const { lang, setLang, t } = useLang()
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)
  const currentLang = LANGS.find(l => l.code === lang) ?? LANGS[0]

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Hide on full-screen auth pages
  if (HEADERLESS.some(p => pathname?.startsWith(p))) return null

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 52, background: 'rgba(0,0,0,0.97)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 0,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ── Logo ── */}
      <Link href="/" className="bikco-logo" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 900, color: '#fff', textDecoration: 'none', letterSpacing: '-0.5px', flexShrink: 0 }}>
        <BikcoDuck size={22} />
        BIKCO
      </Link>

      {/* ── Center links ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <NavLink href="/feed" active={pathname === '/feed'}>{t('nav_feed')}</NavLink>
        <NavLink href="/nova-demanda" active={pathname === '/nova-demanda'}>{t('nav_publish')}</NavLink>
      </div>

      {/* ── Right ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Seletor de idioma (em todas as páginas) */}
        <div ref={langRef} style={{ position: 'relative' }}>
          <button onClick={() => setLangOpen(o => !o)} aria-label="Idioma"
            style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #1e1e1e', borderRadius: 99, padding: '0 9px', color: '#bbb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Flag cc={currentLang.cc} size={18} />
            <span style={{ textTransform: 'uppercase' }}>{currentLang.code}</span>
          </button>
          {langOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 6, minWidth: 180, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              {LANGS.map(l => (
                <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: l.code === lang ? 'rgba(0,212,255,0.1)' : 'none', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#ddd', fontSize: 13, fontWeight: l.code === lang ? 700 : 500, fontFamily: 'inherit' }}>
                  <Flag cc={l.cc} size={20} />{l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111' }} />
        ) : !isAuthenticated ? (
          <Link href="/auth" style={{
            height: 34, padding: '0 16px', borderRadius: 8,
            background: '#fff', color: '#000',
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
            display: 'flex', alignItems: 'center',
          }}>
            {t('nav_login')}
          </Link>
        ) : (
          <div ref={dropRef} style={{ position: 'relative' }}>
            {/* Avatar button */}
            <button
              onClick={() => setOpen(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                border: `1px solid ${open ? '#333' : '#1e1e1e'}`,
                background: profile?.avatar_url ? 'none' : '#111',
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, flexShrink: 0, transition: 'border-color 0.15s',
              }}
            >
              {profile?.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 12, fontWeight: 800, color: '#00d4ff' }}>
                    {initials(profile?.full_name ?? profile?.username ?? '')}
                  </span>
              }
            </button>

            {/* Dropdown */}
            {open && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: '#0f0f0f', border: '1px solid #1e1e1e',
                borderRadius: 12, padding: '6px 0', minWidth: 192,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              }}>
                {/* User info */}
                <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid #1a1a1a' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name ?? profile?.username ?? 'Usuário'}
                  </p>
                  {profile?.email && (
                    <p style={{ fontSize: 11, color: '#444', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile.email}
                    </p>
                  )}
                </div>

                {/* Menu items */}
                {[
                  { label: '👤  Meu perfil',       href: '/perfil' },
                  { label: '💬  Minhas conversas', href: '/conversas' },
                  { label: '📋  Meus pedidos',     href: '/meus-pedidos' },
                ].map(item => (
                  <Link key={item.href} href={item.href}
                    onClick={() => setOpen(false)}
                    style={{ display: 'block', padding: '9px 14px', fontSize: 13, color: '#bbb', textDecoration: 'none', fontWeight: 500, transition: 'background 0.1s, color 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#161616'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#bbb' }}
                  >
                    {item.label}
                  </Link>
                ))}

                {/* Sign out */}
                <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 4 }}>
                  <button
                    onClick={handleSignOut}
                    style={{ width: '100%', padding: '9px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

/* ── NavLink helper ── */
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 13, color: active ? '#fff' : '#555', textDecoration: 'none', fontWeight: active ? 700 : 500, transition: 'color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
      onMouseLeave={e => (e.currentTarget.style.color = active ? '#fff' : '#555')}
    >
      {children}
    </Link>
  )
}
