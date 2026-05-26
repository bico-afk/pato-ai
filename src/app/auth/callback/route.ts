import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/* ── Username generator ─────────────────────────────────────── */
// Attempts to infer state code from IP via X-Forwarded-For.
// Falls back to random 3-letter suffix.
async function inferStateSuffix(request: NextRequest): Promise<string> {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      ''
    if (!ip || ip === '127.0.0.1' || ip === '::1') return randomSuffix()

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'Bikco/1.0' },
      signal: AbortSignal.timeout(2000),
    })
    const data = await res.json() as { region_code?: string; country_code?: string }
    if (data.country_code === 'BR' && data.region_code) {
      return data.region_code.toLowerCase().slice(0, 2)
    }
  } catch { /* ignore — fallback below */ }
  return randomSuffix()
}

function randomSuffix(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz'
  return Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateUsername(suffix: string): string {
  const n = Math.floor(Math.random() * 900) + 100
  return `usuario_${suffix}${n}`
}

/* ── Callback handler ───────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code    = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? ''
  const next    = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  const type    = searchParams.get('type')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/auth?error=callback_failed`)
  }

  // Password recovery — redirect to reset page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  const authUser = data.session.user

  // Check if user profile already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (existingUser) {
    // Returning user — send to requested next or home
    return NextResponse.redirect(`${origin}${next}`)
  }

  // New user — create profile automatically
  const suffix   = await inferStateSuffix(request)
  let username   = generateUsername(suffix)

  // Ensure username uniqueness (retry once on conflict)
  const { data: taken } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (taken) {
    username = generateUsername(randomSuffix())
  }

  const email = authUser.email ?? null
  const phone = authUser.phone ?? null

  await supabase.from('users').insert({
    auth_id:            authUser.id,
    username,
    email,
    phone,
    full_name:          (authUser.user_metadata?.full_name as string | undefined) ?? null,
    preferred_language: 'pt',
    is_anonymous:       false,
    is_active:          true,
    is_suspended:       false,
  })

  // New user → onboarding
  return NextResponse.redirect(`${origin}/onboarding`)
}
