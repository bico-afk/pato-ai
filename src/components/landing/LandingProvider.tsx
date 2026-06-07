'use client'

import { createContext, useContext, useMemo } from 'react'
import { type Theme, type Palette, type Lang } from '@/lib/landing/i18n'
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
  // Idioma E tema vêm do provider GLOBAL (fonte única).
  const { lang, setLang, t, theme, setTheme, toggleTheme, c } = useLang()

  const value = useMemo<Ctx>(() => ({
    theme, lang, c, t, setTheme, setLang, toggleTheme,
  }), [theme, lang, c, t, setTheme, setLang, toggleTheme])

  return <LandingCtx.Provider value={value}>{children}</LandingCtx.Provider>
}
