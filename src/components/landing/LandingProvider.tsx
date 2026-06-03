'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { PALETTES, translate, type Lang, type Theme, type Palette } from '@/lib/landing/i18n'

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
  const [theme, setTheme] = useState<Theme>('dark')
  const [lang,  setLang]  = useState<Lang>('pt')

  // Lê preferências salvas no client (evita mismatch de hidratação).
  useEffect(() => {
    try {
      const st = localStorage.getItem('bikco_theme') as Theme | null
      const sl = localStorage.getItem('bikco_lang') as Lang | null
      if (st === 'dark' || st === 'light') setTheme(st)
      if (sl) setLang(sl)
      else {
        const nav = navigator.language.slice(0, 2)
        const map: Record<string, Lang> = { pt: 'pt', en: 'en', es: 'es', zh: 'zh', de: 'de', fr: 'fr', it: 'it' }
        if (map[nav]) setLang(map[nav])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { try { localStorage.setItem('bikco_theme', theme) } catch {} }, [theme])
  useEffect(() => { try { localStorage.setItem('bikco_lang', lang) } catch {} }, [lang])

  const value = useMemo<Ctx>(() => ({
    theme, lang,
    c: PALETTES[theme],
    t: (key: string) => translate(lang, key),
    setTheme, setLang,
    toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
  }), [theme, lang])

  return <LandingCtx.Provider value={value}>{children}</LandingCtx.Provider>
}
