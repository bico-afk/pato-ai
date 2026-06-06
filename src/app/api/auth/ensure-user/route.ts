import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/* Garante que existe uma linha em public.users para o usuário logado.
   Chamado pelo app logo após o verifyOtp (login por WhatsApp), já que o
   fluxo de telefone não passa pelo /auth/callback (que cria a linha no email). */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: existing } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()

  if (!existing) {
    const username = `usuario_${Math.random().toString(36).slice(2, 8)}`
    const { error } = await supabase.from('users').insert({
      auth_id:      user.id,
      username,
      phone:        user.phone ? user.phone.replace(/\D/g, '') : null,
      email:        user.email ?? null,
      is_anonymous: false,
    })
    if (error) {
      console.error('[ensure-user] insert error:', error.code, error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, created: true })
  }

  return NextResponse.json({ ok: true, created: false })
}
