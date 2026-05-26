import { NextRequest, NextResponse }       from 'next/server'
import { getAuthUser, isAdminUser } from '@/lib/auth'

/**
 * GET /api/admin/check
 * Retorna { isAdmin: boolean } — usado pelo /admin/leads para verificar acesso.
 * Lê ADMIN_EMAILS (env server-side, não exposta no cliente).
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
  if (!isAdminUser(user)) return NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  return NextResponse.json({ isAdmin: true })
}
