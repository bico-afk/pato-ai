import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/* Address autocomplete (public — landing page). Proxies Google Places
   Autocomplete (New) so the API key stays server-side. */

interface Suggestion {
  placeId: string
  main:    string   // street / place
  sub:     string   // city, state
}

export async function POST(req: NextRequest) {
  const apiKey = (process.env.GOOGLE_PLACES_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) return NextResponse.json({ suggestions: [] })

  let input = ''
  let sessionToken = ''
  try {
    const body = await req.json()
    input        = (body.input ?? '').trim()
    sessionToken = body.sessionToken ?? ''
  } catch {
    return NextResponse.json({ suggestions: [] })
  }

  if (input.length < 3) return NextResponse.json({ suggestions: [] })

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        languageCode:        'pt-BR',
        regionCode:          'BR',
        includedRegionCodes: ['br'],
        ...(sessionToken ? { sessionToken } : {}),
      }),
    })

    if (!res.ok) {
      console.error('[geo/autocomplete] google', res.status, await res.text())
      return NextResponse.json({ suggestions: [] })
    }

    const data = await res.json()
    type Pred = {
      placePrediction?: {
        placeId?: string
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
        text?: { text?: string }
      }
    }
    const suggestions: Suggestion[] = (data.suggestions ?? [])
      .map((s: Pred) => s.placePrediction)
      .filter(Boolean)
      .map((p: NonNullable<Pred['placePrediction']>) => ({
        placeId: p.placeId ?? '',
        main:    p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        sub:     p.structuredFormat?.secondaryText?.text ?? '',
      }))
      .filter((s: Suggestion) => s.placeId && s.main)

    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('[geo/autocomplete] exception:', e)
    return NextResponse.json({ suggestions: [] })
  }
}
