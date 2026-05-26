import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/places/photo?ref=<encoded_photo_resource_name>
 *
 * Proxy server-side para fotos do Google Places v1.
 * Mantém a API key no servidor — nunca exposta ao cliente.
 */
export async function GET(req: NextRequest) {
  const apiKey = (process.env.GOOGLE_PLACES_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) return new NextResponse(null, { status: 404 })

  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref || ref.length > 500) return new NextResponse(null, { status: 400 })

  try {
    const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=400&skipHttpRedirect=true&key=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 86400 } })

    if (!res.ok) {
      console.error('[places/photo] Google error', res.status)
      return new NextResponse(null, { status: res.status })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    console.error('[places/photo] proxy error:', e)
    return new NextResponse(null, { status: 502 })
  }
}
