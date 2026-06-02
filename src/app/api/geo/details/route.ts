import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/* Place details — resolves a selected suggestion into structured address
   components (city, state, country, CEP, coords). Key stays server-side. */

interface AddressComponent {
  longText?:  string
  shortText?: string
  types?:     string[]
}

export interface GeoDetails {
  city:      string
  state:     string   // UF (short)
  country:   string   // BR (short)
  cep:       string
  lat:       number | null
  lng:       number | null
  formatted: string
}

function pick(comps: AddressComponent[], type: string, short = false): string {
  const c = comps.find(x => (x.types ?? []).includes(type))
  return (short ? c?.shortText : c?.longText) ?? ''
}

export async function POST(req: NextRequest) {
  const apiKey = (process.env.GOOGLE_PLACES_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) return NextResponse.json({ ok: false }, { status: 500 })

  let placeId = ''
  let sessionToken = ''
  try {
    const body = await req.json()
    placeId      = body.placeId ?? ''
    sessionToken = body.sessionToken ?? ''
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (!placeId) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': 'addressComponents,location,formattedAddress',
      },
    })
    if (!res.ok) {
      console.error('[geo/details] google', res.status, await res.text())
      return NextResponse.json({ ok: false }, { status: 502 })
    }

    const data  = await res.json()
    const comps = (data.addressComponents ?? []) as AddressComponent[]

    const city =
      pick(comps, 'administrative_area_level_2') ||
      pick(comps, 'locality') ||
      pick(comps, 'administrative_area_level_3') ||
      pick(comps, 'sublocality')

    const details: GeoDetails = {
      city,
      state:     pick(comps, 'administrative_area_level_1', true),
      country:   pick(comps, 'country', true) || 'BR',
      cep:       pick(comps, 'postal_code'),
      lat:       data.location?.latitude  ?? null,
      lng:       data.location?.longitude ?? null,
      formatted: data.formattedAddress ?? '',
    }

    return NextResponse.json({ ok: true, details })
  } catch (e) {
    console.error('[geo/details] exception:', e)
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
