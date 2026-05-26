import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const origin = new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Verificar se usuário já tem perfil na tabela users
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!profile) {
          // Novo usuário — criar perfil
          const username = `usuario_${Math.random().toString(36).substring(2, 8)}`
          await supabase.from('users').insert({
            auth_id: user.id,
            username,
            email: user.email,
            is_anonymous: false,
          })
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=callback_failed`)
}
