'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  auth_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  email: string | null
  preferred_language: string
  is_anonymous: boolean
  is_active: boolean
  created_at: string
}

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
  })

  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single()
    if (error || !data) return null
    return data as UserProfile
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      const result = await supabase.auth.getSession()
      const session: Session | null = result.data.session
      if (!mounted) return
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (mounted) setState({ user: session.user, profile, loading: false, isAuthenticated: true })
      } else {
        setState({ user: null, profile: null, loading: false, isAuthenticated: false })
      }
    }
    init()

    // Listen for auth changes.
    // IMPORTANTE: NÃO chamar funções do Supabase DENTRO deste callback —
    // ele roda segurando o "auth lock"; chamar supabase.from()/getUser() aqui
    // trava o lock e faz o verifyOtp/signIn pendurar pra sempre (spinner infinito).
    // Solução: marcar o estado de forma síncrona e buscar o perfil FORA do callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!mounted) return
        if (session?.user) {
          const u = session.user
          setState(prev => ({ ...prev, user: u, loading: false, isAuthenticated: true }))
          // adia a leitura do perfil para liberar o lock antes
          setTimeout(async () => {
            const profile = await fetchProfile(u.id)
            if (mounted) setState({ user: u, profile, loading: false, isAuthenticated: true })
          }, 0)
        } else {
          setState({ user: null, profile: null, loading: false, isAuthenticated: false })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) throw error
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) throw error
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!state.user) throw new Error('Não autenticado')
    const { error } = await supabase
      .from('users')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('auth_id', state.user.id)
    if (error) throw error
    // Refresh profile in state
    const profile = await fetchProfile(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, signInWithEmail, signInWithPhone, verifyOtp, signOut, updateProfile }
}
