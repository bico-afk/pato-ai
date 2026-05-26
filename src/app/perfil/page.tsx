'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface UserRow {
  id:         string
  username:   string
  full_name:  string | null
  avatar_url: string | null
  bio:        string | null
  email:      string | null
  created_at: string
}

interface ProfProfile {
  headline:            string | null
  skills:              string[] | null
  location_city:       string | null
  location_state:      string | null
  service_radius_km:   number
  avg_rating:          number
  total_reviews:       number
  total_jobs_completed:number
  is_available:        boolean
}

interface Review {
  id:                 string
  rating:             number
  comment:            string | null
  created_at:         string
  reviewer_username:  string
}

function stars(avg: number) {
  return Array.from({ length: 5 }, (_, i) => i < Math.round(avg) ? '★' : '☆').join('')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function PerfilPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [user,         setUser]         = useState<UserRow | null>(null)
  const [prof,         setProf]         = useState<ProfProfile | null>(null)
  const [reviews,      setReviews]      = useState<Review[]>([])
  const [demandCount,  setDemandCount]  = useState(0)
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth'); return }

    const { data: userRow } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, bio, email, created_at')
      .eq('auth_id', session.user.id)
      .single()
    if (!userRow) { setLoading(false); return }

    const u = userRow as unknown as UserRow
    setUser(u)

    const [profRes, reviewsRes, demandsRes] = await Promise.all([
      supabase.from('professional_profiles')
        .select('headline, skills, location_city, location_state, service_radius_km, avg_rating, total_reviews, total_jobs_completed, is_available')
        .eq('user_id', u.id)
        .single(),
      supabase.from('reviews')
        .select('id, rating, comment, created_at, reviewer:reviewer_id(username)')
        .eq('reviewed_id', u.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('demands')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.id),
    ])

    if (profRes.data) setProf(profRes.data as unknown as ProfProfile)

    if (reviewsRes.data) {
      type RawReview = { id: string; rating: number; comment: string | null; created_at: string; reviewer: { username: string } | null }
      setReviews((reviewsRes.data as unknown as RawReview[]).map(r => ({
        id:                r.id,
        rating:            r.rating,
        comment:           r.comment,
        created_at:        r.created_at,
        reviewer_username: r.reviewer?.username ?? '@anon',
      })))
    }

    setDemandCount(demandsRes.count ?? 0)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 28, height: 28, border: '2px solid #111', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return null

  return (
    <div style={{ minHeight: '100dvh', background: '#000', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      {/* Header */}
      <header style={{ padding: '20px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-0.5px' }}>BIKCO</Link>
        <button onClick={() => router.push('/perfil/editar')}
          style={{ height: 34, padding: '0 16px', borderRadius: 8, background: '#fff', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Editar
        </button>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Profile card */}
        <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: user.bio ? 14 : 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#111', border: '1px solid #1e1e1e', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 800, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name ?? user.username}
              </p>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 4px' }}>{user.username}</p>
              {prof?.headline && <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{prof.headline}</p>}
            </div>
            {prof?.is_available && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
                disponível
              </span>
            )}
          </div>

          {user.bio && <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6, margin: '0 0 12px' }}>{user.bio}</p>}

          {prof && (prof.location_city || prof.location_state) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', marginTop: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff4d7e" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {[prof.location_city, prof.location_state].filter(Boolean).join(', ')}
              {prof.service_radius_km > 0 && <span style={{ color: '#333' }}>· {prof.service_radius_km} km</span>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Avaliação',    value: prof && prof.avg_rating > 0 ? `${Number(prof.avg_rating).toFixed(1)} ★` : '—' },
            { label: 'Pedidos',      value: demandCount },
            { label: 'Bicos feitos', value: prof?.total_jobs_completed ?? 0 },
          ].map(s => (
            <div key={s.label} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Skills */}
        {prof?.skills && prof.skills.length > 0 && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#fff' }}>Habilidades</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {prof.skills.map(s => (
                <span key={s} style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 99, padding: '5px 12px', fontSize: 13, color: '#00d4ff' }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* No professional profile CTA */}
        {!prof && (
          <div style={{ background: '#0f0f0f', border: '1px dashed #222', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#555', margin: '0 0 16px', lineHeight: 1.6 }}>
              Você ainda não tem perfil profissional.<br />
              <span style={{ fontSize: 12, color: '#444' }}>Crie para aparecer nas buscas e receber chamados.</span>
            </p>
            <button onClick={() => router.push('/criar-perfil')}
              style={{ height: 44, padding: '0 24px', borderRadius: 10, border: 'none', background: '#fff', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Criar perfil profissional →
            </button>
          </div>
        )}

        {/* Reviews */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
            Avaliações{reviews.length > 0 && <span style={{ color: '#444', fontWeight: 400, fontSize: 13 }}> ({reviews.length})</span>}
          </h2>
          {reviews.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '1px dashed #1e1e1e', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#444', margin: 0 }}>Ainda sem avaliações</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: r.comment ? 8 : 0 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.reviewer_username}</span>
                      <span style={{ fontSize: 13, color: '#f59e0b', marginLeft: 8 }}>{stars(r.rating)}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#444' }}>{fmtDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5, margin: 0 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <button onClick={() => router.push('/meus-pedidos')}
            style={{ height: 48, borderRadius: 10, border: '1px solid #1e1e1e', background: '#0f0f0f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Meus pedidos
          </button>
          <button onClick={() => router.push('/conversas')}
            style={{ height: 48, borderRadius: 10, border: '1px solid #1e1e1e', background: '#0f0f0f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Conversas
          </button>
          {prof && (
            <button onClick={() => router.push('/criar-perfil')}
              style={{ height: 48, borderRadius: 10, border: '1px solid #1e1e1e', background: '#0f0f0f', color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Editar perfil profissional
            </button>
          )}
          <button onClick={handleSignOut}
            style={{ height: 48, borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Sair da conta
          </button>
        </div>

      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
