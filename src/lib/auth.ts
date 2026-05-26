/**
 * Helpers de autenticação server-side (API Routes).
 *
 * O cliente browser usa @supabase/supabase-js com persistSession (localStorage).
 * Para validar a sessão no servidor, o cliente inclui o access_token no header
 * "Authorization: Bearer <token>" em todas as chamadas de API.
 * O servidor lê esse token e valida com supabase.auth.getUser(token).
 */
import { createClient as createSupabase } from '@supabase/supabase-js'
import { NextRequest, NextResponse }        from 'next/server'
import type { User }                        from '@supabase/supabase-js'

/* ── Extrai e valida o Bearer token da requisição ── */
export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

/* ── Respostas padrão ── */
export function unauthorized(msg = 'Não autenticado') {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 })
}

export function forbidden(msg = 'Acesso não autorizado') {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 })
}

/* ── Verifica role admin ────────────────────────────────────────────
   Lê ADMIN_EMAILS (env server-side, nunca exposta no bundle cliente).
   Se não configurada: NEGA acesso — configure ADMIN_EMAILS no Vercel. */
export function isAdminUser(user: User): boolean {
  const adminEmailsStr = (process.env.ADMIN_EMAILS ?? '').trim()
  if (!adminEmailsStr) {
    console.warn('[auth] ADMIN_EMAILS não configurado — acesso admin negado por padrão')
    return false
  }
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase())
  return adminEmails.includes((user.email ?? '').toLowerCase())
}
