import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — evita múltiplas instâncias no browser
let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    return createSupabaseClient(supabaseUrl, supabaseAnon)
  }
  if (!client) {
    client = createSupabaseClient(supabaseUrl, supabaseAnon, {
      auth: {
        persistSession:    true,
        autoRefreshToken:  true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
