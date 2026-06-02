import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/* Reverse geocode lat/lng → structured address (for the "use my location" button). */

interface Comp { long_name: string; short_name: string; types: string[] }

function pick(comps: Comp[], type: string, short = false): string {
  const c = comps.find(x => x.types.includes(type))
  return (short ? c?.short_name : c?.long_name) ?? ''
}

export async function POST(req: NextRequest) {
  const apiKey = (process.env.GOOGLE_PLACES_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) return NextResponse.json({ ok: false }, { status: 500 })

  let lat = 0, lng = 0
  try {
    const body = await req.json()
    lat = Number(body.lat); lng = Number(body.lng)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (!lat || !lng) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    const comps = (data.results?.[0]?.address_components ?? []) as Comp[]

    const city =
      pick(comps, 'administrative_area_level_2') ||
      pick(comps, 'locality') ||
      pick(comps, 'administrative_area_level_3')

    return NextResponse.json({
      ok: true,
      details: {
        city,
        state:     pick(comps, 'administrative_area_level_1', true),
        country:   pick(comps, 'country', true) || 'BR',
        cep:       pick(comps, 'postal_code'),
        lat, lng,
        formatted: data.results?.[0]?.formatted_address ?? '',
      },
    })
  } catch (e) {
    console.error('[geo/reverse] exception:', e)
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
