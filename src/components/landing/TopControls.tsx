'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanding } from './LandingProvider'
import { LANGS } from '@/lib/landing/i18n'
import Flag from './Flag'

/* Seletor de idioma (bandeiras) + alternador de tema claro/escuro. */
export default function TopControls() {
  const { c, lang, setLang, theme, toggleTheme } = useLanding()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]

  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const btn: React.CSSProperties = {
    height: 36, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 99, padding: '0 12px',
    color: c.text, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
      {/* Idioma */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button style={btn} onClick={() => setOpen(o => !o)} aria-label="Idioma">
          <Flag cc={current.cc} size={20} />
          <span>{current.code.toUpperCase()}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c.text2} strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 6, minWidth: 188, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: l.code === lang ? `${c.cyan}18` : 'none', border: 'none', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', color: c.text, fontSize: 13.5, fontWeight: l.code === lang ? 700 : 500, fontFamily: 'inherit' }}>
                <Flag cc={l.cc} size={22} />{l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tema */}
      <button style={{ ...btn, padding: 0, width: 36, justifyContent: 'center' }} onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
        {theme === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        )}
      </button>
    </div>
  )
}
