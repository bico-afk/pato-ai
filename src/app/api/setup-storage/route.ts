import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurado nas env vars do Vercel.' },
      { status: 500 }
    )
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false },
  })

  const results: Record<string, string> = {}

  for (const bucketId of ['posts-media', 'post-photos', 'chat-media']) {
    // Tenta criar — ignora erro se já existir
    const { error } = await admin.storage.createBucket(bucketId, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024, // 20 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'],
    })

    if (error && !error.message.includes('already exists')) {
      results[bucketId] = `erro: ${error.message}`
    } else {
      // Garante que é público
      await admin.storage.updateBucket(bucketId, { public: true })
      results[bucketId] = 'ok'
    }
  }

  return NextResponse.json({ buckets: results })
}
