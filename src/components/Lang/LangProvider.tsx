'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translate, PALETTES, type Lang, type Theme, type Palette } from '@/lib/landing/i18n'

/* Provider GLOBAL de idioma + tema (envolve o app inteiro no layout).
   Fonte única — landing, navbar, barra de publicar e páginas leem daqui. */

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  c: Palette
}

const LangCtx = createContext<Ctx | null>(null)

export function useLang(): Ctx {
  const ctx = useContext(LangCtx)
  if (!ctx) throw new Error('useLang deve ser usado dentro de <LangProvider>')
  return ctx
}

const NAV_MAP: Record<string, Lang> = { pt: 'pt', en: 'en', es: 'es', zh: 'zh', de: 'de', fr: 'fr', it: 'it' }

export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang]   = useState<Lang>('pt')
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('bikco_lang') as Lang | null
      if (savedLang && NAV_MAP[savedLang]) setLang(savedLang)
      else {
        const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase()
        if (NAV_MAP[nav]) setLang(NAV_MAP[nav])
      }
      const savedTheme = localStorage.getItem('bikco_theme') as Theme | null
      if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('bikco_lang', lang)
      document.cookie = `bikco_lang=${lang};path=/;max-age=31536000;samesite=lax`
    } catch { /* ignore */ }
  }, [lang])

  useEffect(() => { try { localStorage.setItem('bikco_theme', theme) } catch {} }, [theme])

  const value = useMemo<Ctx>(() => ({
    lang, setLang,
    t: (key: string) => translate(lang, key),
    theme, setTheme,
    toggleTheme: () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark')),
    c: PALETTES[theme],
  }), [lang, theme])

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}
