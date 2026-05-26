import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser, unauthorized, forbidden, isAdminUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  /* ── Requer admin ── */
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  if (!isAdminUser(user)) return forbidden()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 })
  }

  const supabase = serviceKey
    ? createClient(url, serviceKey)
    : createClient(url, anonKey)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')

  if (error || !profiles?.length) {
    return NextResponse.json({ synced: 0, error: error?.message })
  }

  const results = await Promise.allSettled(
    profiles.map(p =>
      supabase.rpc('recalcular_score', { p_user_id: p.id })
    )
  )

  const ok   = results.filter(r => r.status === 'fulfilled').length
  const fail = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({
    synced: ok,
    failed: fail,
    total: profiles.length,
  })
}
