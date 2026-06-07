'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translate, type Lang } from '@/lib/landing/i18n'

/* Provider GLOBAL de idioma (envolve o app inteiro no layout).
   Fonte única do idioma — landing, navbar e páginas internas leem daqui.
   Persiste em localStorage + cookie (para o servidor/IA quando precisar). */

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LangCtx = createContext<Ctx | null>(null)

export function useLang(): Ctx {
  const ctx = useContext(LangCtx)
  if (!ctx) throw new Error('useLang deve ser usado dentro de <LangProvider>')
  return ctx
}

const NAV_MAP: Record<string, Lang> = { pt: 'pt', en: 'en', es: 'es', zh: 'zh', de: 'de', fr: 'fr', it: 'it' }

export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('pt')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bikco_lang') as Lang | null
      if (saved && NAV_MAP[saved]) { setLang(saved); return }
      const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase()
      if (NAV_MAP[nav]) setLang(NAV_MAP[nav])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('bikco_lang', lang)
      document.cookie = `bikco_lang=${lang};path=/;max-age=31536000;samesite=lax`
    } catch { /* ignore */ }
  }, [lang])

  const value = useMemo<Ctx>(() => ({
    lang, setLang, t: (key: string) => translate(lang, key),
  }), [lang])

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}
