import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/* ─── Types ──────────────────────────────────────────────── */
interface RawPlace {
  id?: string
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  photos?: Array<{ name: string }>
  regularOpeningHours?: { openNow?: boolean }
}

export interface PlaceResult {
  id: string
  name: string
  rating: number | null
  ratingCount: number
  address: string
  phone: string | null
  photoUrl: string | null
  photoCount: number
  websiteUrl: string | null
  isOpenNow: boolean | null
  scoreExterno: number
}

/* ─── Score Biko Externo (0–1000) ────────────────────────── */
function calcScoreExterno(
  rating: number | null,
  ratingCount: number,
  hasWebsite: boolean,
  hasPhone: boolean,
  photoCount: number,
): number {
  // Avaliação Google — 40%
  const ratingPts  = rating ? (rating / 5) * 300 : 0         // max 300
  const reviewPts  = Math.min(ratingCount / 300, 1) * 100    // max 100

  // Presença digital — 20%
  const sitePts    = hasWebsite ? 150 : 0                    // max 150
  const phonePts   = hasPhone   ?  50 : 0                    // max  50

  // Fotos de trabalhos — 20%
  const photoPts   = Math.min(photoCount / 10, 1) * 200      // max 200

  // Bônus volume de reviews — 20%
  const bonusA = ratingCount >= 50  ?  50 : 0
  const bonusB = ratingCount >= 200 ?  50 : 0
  const bonusPts = bonusA + bonusB                           // max 100

  return Math.round(Math.min(
    ratingPts + reviewPts + sitePts + phonePts + photoPts + bonusPts,
    1000,
  ))
}

/* ─── Coordenadas de cidades BR ──────────────────────────── */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'taubaté':             { lat: -23.0268, lng: -45.5557 },
  'são paulo':           { lat: -23.5505, lng: -46.6333 },
  'sao paulo':           { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro':      { lat: -22.9068, lng: -43.1729 },
  'belo horizonte':      { lat: -19.9167, lng: -43.9345 },
  'salvador':            { lat: -12.9714, lng: -38.5014 },
  'fortaleza':           { lat:  -3.7172, lng: -38.5433 },
  'curitiba':            { lat: -25.4290, lng: -49.2671 },
  'manaus':              { lat:  -3.1190, lng: -60.0217 },
  'recife':              { lat:  -8.0476, lng: -34.8770 },
  'porto alegre':        { lat: -30.0277, lng: -51.2287 },
  'belém':               { lat:  -1.4558, lng: -48.5044 },
  'belem':               { lat:  -1.4558, lng: -48.5044 },
  'goiânia':             { lat: -16.6869, lng: -49.2648 },
  'goiania':             { lat: -16.6869, lng: -49.2648 },
  'campinas':            { lat: -22.9099, lng: -47.0626 },
  'santos':              { lat: -23.9608, lng: -46.3336 },
  'são josé dos campos': { lat: -23.1794, lng: -45.8869 },
  'sao jose dos campos': { lat: -23.1794, lng: -45.8869 },
  'ribeirão preto':      { lat: -21.1704, lng: -47.8103 },
  'ribeirao preto':      { lat: -21.1704, lng: -47.8103 },
  'sorocaba':            { lat: -23.5015, lng: -47.4526 },
  'uberlândia':          { lat: -18.9186, lng: -48.2772 },
  'uberlandia':          { lat: -18.9186, lng: -48.2772 },
  'brasília':            { lat: -15.7942, lng: -47.8825 },
  'brasilia':            { lat: -15.7942, lng: -47.8825 },
  'natal':               { lat:  -5.7945, lng: -35.2110 },
  'maceió':              { lat:  -9.6658, lng: -35.7350 },
  'maceio':              { lat:  -9.6658, lng: -35.7350 },
  'teresina':            { lat:  -5.0892, lng: -42.8019 },
  'campo grande':        { lat: -20.4697, lng: -54.6201 },
  'joão pessoa':         { lat:  -7.1195, lng: -34.8450 },
  'joao pessoa':         { lat:  -7.1195, lng: -34.8450 },
  'aracaju':             { lat: -10.9472, lng: -37.0731 },
  'macapá':              { lat:   0.0349, lng: -51.0694 },
  'macapa':              { lat:   0.0349, lng: -51.0694 },
  'porto velho':         { lat:  -8.7619, lng: -63.9039 },
  'boa vista':           { lat:   2.8235, lng: -60.6758 },
  'palmas':              { lat: -10.2491, lng: -48.3243 },
  'florianópolis':       { lat: -27.5954, lng: -48.5480 },
  'florianopolis':       { lat: -27.5954, lng: -48.5480 },
  'vitória':             { lat: -20.3155, lng: -40.3128 },
  'vitoria':             { lat: -20.3155, lng: -40.3128 },
}

function getCityCoords(city: string) {
  return CITY_COORDS[city.toLowerCase().trim()] ?? null
}

/* ─── Handler ────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  /* ── Requer sessão (anônima ou autenticada) para proteger cota da API ── */
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ places: [] })

  const apiKey = (process.env.GOOGLE_PLACES_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) return NextResponse.json({ places: [] })

  let query = '', city = '', lat = 0, lng = 0
  try {
    const body = await req.json()
    query = body.query ?? ''
    city  = body.city  ?? ''
    lat   = body.lat   ?? 0
    lng   = body.lng   ?? 0
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!query.trim()) return NextResponse.json({ places: [] })

  const cityStr   = city.trim()
  const textQuery = cityStr
    ? `${query} em ${cityStr}, Brasil`
    : `${query} no Brasil`

  const coords = (lat && lng)
    ? { lat, lng }
    : cityStr ? getCityCoords(cityStr) : null

  const requestBody: Record<string, unknown> = {
    textQuery,
    languageCode: 'pt-BR',
    regionCode:   'BR',
    pageSize:     8,
  }

  if (coords) {
    requestBody.locationBias = {
      circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 50000.0 },
    }
  } else {
    requestBody.locationRestriction = {
      rectangle: {
        low:  { latitude: -33.75, longitude: -73.99 },
        high: { latitude:   5.27, longitude: -34.73 },
      },
    }
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.rating',
          'places.userRatingCount',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.photos',
          'places.regularOpeningHours.openNow',
        ].join(','),
      },
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      console.error('[places] Google error', res.status, await res.text())
      return NextResponse.json({ places: [] })
    }

    const data = await res.json()
    const raw: RawPlace[] = data.places ?? []

    const places: PlaceResult[] = raw.map(p => {
      const photoCount = p.photos?.length ?? 0
      const hasWebsite = !!p.websiteUri
      const hasPhone   = !!p.nationalPhoneNumber
      const rating     = p.rating ?? null
      const ratingCount = p.userRatingCount ?? 0
      const scoreExterno = calcScoreExterno(rating, ratingCount, hasWebsite, hasPhone, photoCount)

      return {
        id:          p.id ?? Math.random().toString(36).slice(2),
        name:        p.displayName?.text ?? 'Negócio',
        rating,
        ratingCount,
        address:     p.formattedAddress ?? '',
        phone:       p.nationalPhoneNumber ?? null,
        photoUrl:    p.photos?.[0]?.name
          ? `/api/places/photo?ref=${encodeURIComponent(p.photos[0].name)}`
          : null,
        photoCount,
        websiteUrl:  p.websiteUri ?? null,
        isOpenNow:   p.regularOpeningHours?.openNow ?? null,
        scoreExterno,
      }
    })

    // Ordenar por score decrescente
    places.sort((a, b) => b.scoreExterno - a.scoreExterno)

    return NextResponse.json({ places })
  } catch (e) {
    console.error('[places] exception:', e)
    return NextResponse.json({ places: [] })
  }
}
