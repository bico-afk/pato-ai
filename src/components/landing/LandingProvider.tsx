'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { PALETTES, type Theme, type Palette, type Lang } from '@/lib/landing/i18n'
import { useLang } from '@/components/Lang/LangProvider'

interface Ctx {
  theme: Theme
  lang: Lang
  c: Palette
  t: (key: string) => string
  setTheme: (t: Theme) => void
  setLang: (l: Lang) => void
  toggleTheme: () => void
}

const LandingCtx = createContext<Ctx | null>(null)

export function useLanding(): Ctx {
  const ctx = useContext(LandingCtx)
  if (!ctx) throw new Error('useLanding deve ser usado dentro de <LandingProvider>')
  return ctx
}

export default function LandingProvider({ children }: { children: React.ReactNode }) {
  // Idioma vem do provider GLOBAL (fonte única). Tema é local da landing.
  const { lang, setLang, t } = useLang()
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    try {
      const st = localStorage.getItem('bikco_theme') as Theme | null
      if (st === 'dark' || st === 'light') setTheme(st)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { try { localStorage.setItem('bikco_theme', theme) } catch {} }, [theme])

  const value = useMemo<Ctx>(() => ({
    theme, lang,
    c: PALETTES[theme],
    t, setLang,
    setTheme,
    toggleTheme: () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark')),
  }), [theme, lang, t, setLang])

  return <LandingCtx.Provider value={value}>{children}</LandingCtx.Provider>
}
