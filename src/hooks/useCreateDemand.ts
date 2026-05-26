'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAnonToken } from '@/lib/anonymous'

export interface CreateDemandInput {
  description: string
  locationCity: string
  locationState: string
  locationCountry: string
  locationGooglePlaceId?: string
  locationLat?: number
  locationLng?: number
  mediaUrls?: string[]
  language?: string
}

export interface CreateDemandResult {
  id: string
}

export function useCreateDemand() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  const createDemand = useCallback(async (input: CreateDemandInput): Promise<CreateDemandResult> => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      // Resolve user_id from users table (not auth.uid directly)
      let userId: string | null = null
      if (session?.user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single()
        userId = userRow?.id ?? null
      }

      const anonToken = !userId ? getAnonToken() : null

      // Build location_point if coords provided
      // PostGIS: ST_MakePoint(lng, lat)
      const locationPoint = (input.locationLat != null && input.locationLng != null)
        ? `SRID=4326;POINT(${input.locationLng} ${input.locationLat})`
        : null

      const { data, error: sbError } = await supabase
        .from('demands')
        .insert({
          user_id:                  userId,
          anonymous_token:          anonToken,
          title:                    input.description.slice(0, 120),
          description:              input.description,
          status:                   'open',
          location_city:            input.locationCity,
          location_state:           input.locationState,
          location_country:         input.locationCountry || 'BR',
          location_google_place_id: input.locationGooglePlaceId ?? null,
          location_point:           locationPoint,
          media_urls:               input.mediaUrls ?? [],
          language:                 input.language ?? 'pt',
          candidate_count:          0,
        })
        .select('id')
        .single()

      if (sbError) throw sbError
      if (!data) throw new Error('Demanda não foi criada')

      return { id: data.id }
    } catch (e) {
      console.error('[useCreateDemand] Insert error:', {
        message: e instanceof Error ? e.message : e,
        statusCode: (e as Record<string, unknown>)?.statusCode,
        code: (e as Record<string, unknown>)?.code,
        details: (e as Record<string, unknown>)?.details,
        hint: (e as Record<string, unknown>)?.hint,
        full: e,
      })
      const msg = e instanceof Error ? e.message : 'Erro ao publicar. Tente novamente.'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return { createDemand, loading, error }
}
