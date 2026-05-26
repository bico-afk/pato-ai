'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

/* ─── Types ───────────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  city: string | null
  category: string | null
  skills: string[] | null
  score: number
  seal: string | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  // optional — may not exist in DB yet
  emergency_24h?: boolean | null
  work_radius_km?: number | null
  years_experience?: number | null
  attendance_hours?: string | null
  attendance_days?: string[] | null
  portfolio_urls?: string[] | null
  response_rate?: number | null
  completed_bicos?: number | null
}

interface Avaliacao {
  id: string
  nota: number
  comentario: string | null
  created_at: string
  avaliador_nome: string
  avaliador_avatar: string | null
}

/* ─── Helpers ─────────────────────────────────────────────── */
function sealInfo(seal: string | null) {
  if (seal === 'ouro')  return { icon: '🥇', label: 'Ouro',   color: '#FFD11A' }
  if (seal === 'prata') return { icon: '🥈', label: 'Prata',  color: '#C0C0C0' }
  return                       { icon: '🥉', label: 'Bronze', color: '#CD7F32' }
}

function barColor(score: number): string {
  if (score >= 70) return 'linear-gradient(90deg, #22C55E 0%, #4ADE80 100%)'
  if (score >= 40) return 'linear-gradient(90deg, #FFD11A 0%, #FF9500 100%)'
  return                  'linear-gradient(90deg, #FF4444 0%, #FF7A1A 100%)'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Ótimo'
  if (score >= 40) return 'Bom'
  if (score >= 20) return 'Regular'
  return 'Iniciante'
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? '#FFD11A' : '#333' }}>★</span>
      ))}
    </span>
  )
}

const DAY_MAP: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua',
  qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
}

/* ─── Auth prompt modal ───────────────────────────────────── */
function AuthModal({ onClose, onLogin, onCadastro }: {
  onClose:   () => void
  onLogin:   () => void
  onCadastro: () => void
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, zIndex: 201,
        backgroundColor: '#141414',
        borderRadius: '24px 24px 0 0',
        border: '1px solid #2A2A2A', borderBottom: 'none',
        padding: '24px 24px 48px',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#333', margin: '0 auto 24px' }} />
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
          Faça login para continuar
        </h2>
        <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          Para iniciar uma conversa com este profissional, você precisa ter uma conta na Bikco.com
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onCadastro}
            style={{
              height: 50, borderRadius: 99, border: 'none',
              background: 'linear-gradient(135deg, #FFD11A, #FF9500)',
              color: '#0F0F0F', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Criar conta grátis
          </button>
          <button
            onClick={onLogin}
            style={{
              height: 50, borderRadius: 99, border: '1px solid #2A2A2A',
              background: 'none', color: '#aaa', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Já tenho conta — Entrar
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Page ────────────────────────────────────────────────── */
export default function ProfissionalPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [avaliacoes,    setAvaliacoes]    = useState<Avaliacao[]>([])
  const [completedJobs, setCompletedJobs] = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [isAuthed,      setIsAuthed]      = useState(false)
  const [showAuth,      setShowAuth]      = useState(false)
  const [shareToast,    setShareToast]    = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    async function load() {
      // Auth
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthed(!!session)

      // Profile
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (p) setProfile(p as Profile)

      // Completed jobs
      try {
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('prestador_id', id)
          .eq('status', 'concluido')
        setCompletedJobs(count ?? 0)
      } catch { /* silently ignore */ }

      // Reviews
      try {
        const { data: revs } = await supabase
          .from('avaliacoes')
          .select(`
            id, nota, comentario, created_at,
            avaliador:profiles!avaliador_id(full_name, avatar_url)
          `)
          .eq('avaliado_id', id)
          .order('created_at', { ascending: false })
          .limit(6)

        type RawReview = {
          id: string
          nota: number
          comentario: string | null
          created_at: string
          avaliador: { full_name: string | null; avatar_url: string | null }[] | null
        }
        if (revs) {
          setAvaliacoes(
            (revs as unknown as RawReview[]).map(r => ({
              id:              r.id,
              nota:            r.nota,
              comentario:      r.comentario ?? null,
              created_at:      r.created_at,
              avaliador_nome:  r.avaliador?.[0]?.full_name  ?? 'Anônimo',
              avaliador_avatar: r.avaliador?.[0]?.avatar_url ?? null,
            })),
          )
        }
      } catch { /* silently ignore */ }

      setLoading(false)
    }

    load()
  }, [id])

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share && profile) {
        await navigator.share({ title: profile.full_name, text: `Veja o perfil de ${profile.full_name} na Bikco.com`, url })
        return
      }
    } catch { /* user cancelled or not supported */ }
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setShareToast(true)
    setTimeout(() => setShareToast(false), 2500)
  }

  function handleChat() {
    if (!isAuthed) { setShowAuth(true); return }
    router.push(`/chat/${id}`)
  }

  function handleOrcamento() {
    if (!isAuthed) { setShowAuth(true); return }
    router.push(`/criar-pedido?profissional_id=${id}`)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #1E1E1E', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  /* ── Not found ── */
  if (!profile) {
    return (
      <div style={{
        minHeight: '100dvh', backgroundColor: '#0F0F0F',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: 24, fontFamily: 'Inter, sans-serif', color: '#fff',
      }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Profissional não encontrado</h2>
        <button
          onClick={() => router.back()}
          style={{ height: 44, borderRadius: 99, border: 'none', background: '#FFD11A', color: '#0F0F0F', fontWeight: 800, cursor: 'pointer', padding: '0 24px', fontSize: 14 }}
        >
          ← Voltar
        </button>
      </div>
    )
  }

  /* ── Derived values ── */
  const seal      = sealInfo(profile.seal)
  const scoreNum  = Math.round((profile.score / 100) * 1000)
  const starsAvg  = profile.score > 0 ? (profile.score / 20).toFixed(1) : null
  const avgRating = avaliacoes.length > 0
    ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1)
    : starsAvg

  const jobsCount = profile.completed_bicos ?? completedJobs

  /* ── Render ── */
  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0F0F0F',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
    }}>

      {/* ── Sticky header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1A1A1A',
      }}>
        <div style={{
          maxWidth: 480, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
        }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
            </svg>
          </button>

          <span style={{ fontSize: 15, fontWeight: 700 }}>Perfil</span>

          <button
            onClick={handleShare}
            style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 108 }}>

        {/* ══ CAPA + AVATAR ══ */}
        <div style={{ position: 'relative', marginBottom: 52 }}>
          {/* Cover gradient */}
          <div style={{
            height: 148,
            background: 'linear-gradient(135deg, #FFD11A 0%, #FF9500 50%, #FF4500 100%)',
          }} />

          {/* Avatar */}
          <div style={{ position: 'absolute', bottom: -44, left: 20 }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                style={{
                  width: 88, height: 88, borderRadius: 24, objectFit: 'cover',
                  border: '3px solid #FFD11A',
                  boxShadow: '0 6px 24px rgba(255,209,26,0.35)',
                }}
              />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: 24,
                background: 'linear-gradient(135deg, #1E1E1E, #2A2A2A)',
                border: '3px solid #FFD11A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 900, color: '#FFD11A',
                boxShadow: '0 6px 24px rgba(255,209,26,0.35)',
              }}>
                {initials(profile.full_name)}
              </div>
            )}

            {/* Source badge */}
            <div style={{
              position: 'absolute', bottom: -10, right: -10,
              background: 'rgba(255,209,26,0.15)', border: '1px solid rgba(255,209,26,0.35)',
              borderRadius: 99, padding: '2px 8px',
              fontSize: 11, fontWeight: 600, color: '#FFD11A',
              backdropFilter: 'blur(8px)',
            }}>
              🦆 Bikco
            </div>
          </div>
        </div>

        {/* ══ NOME + CATEGORIA ══ */}
        <div style={{ padding: '0 20px 20px' }}>
          <h1 style={{ fontSize: 23, fontWeight: 900, color: '#fff', margin: '0 0 5px', letterSpacing: '-0.5px' }}>
            {profile.full_name}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            {profile.category && (
              <span style={{ fontSize: 14, color: '#999' }}>{profile.category}</span>
            )}
            {profile.city && (
              <span style={{ fontSize: 14, color: '#666' }}>· 📍 {profile.city}</span>
            )}
          </div>

          {/* Emergency badge */}
          {profile.emergency_24h && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)',
              borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#FF4757',
            }}>
              ⚡ Emergência 24h
            </div>
          )}
        </div>

        {/* ══ SCORE BIKO ══ */}
        <div style={{ margin: '0 16px 14px', padding: 18, background: '#141414', borderRadius: 20, border: '1px solid #1E1E1E' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, color: '#555', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Score Bikco
</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#FFD11A', lineHeight: 1 }}>{scoreNum}</span>
                <span style={{ fontSize: 14, color: '#444' }}>/ 1000</span>
              </div>
              <p style={{ fontSize: 12, color: '#666', margin: '3px 0 0' }}>{scoreLabel(profile.score)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28 }}>{seal.icon}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: seal.color, margin: '4px 0 0' }}>{seal.label}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: 8, background: '#2A2A2A', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${profile.score}%`, height: '100%', borderRadius: 99,
              background: barColor(profile.score),
              transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>

          {/* Min / Max labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: '#444' }}>0</span>
            <span style={{ fontSize: 10, color: '#444' }}>1000</span>
          </div>
        </div>

        {/* ══ STATS GRID ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 16px', marginBottom: 14 }}>
          {[
            { icon: '⭐', label: 'Avaliação', value: starsAvg ?? '—' },
            { icon: '✅', label: 'Trabalhos', value: String(jobsCount) },
            { icon: '📅', label: 'Exp.',       value: profile.years_experience != null ? `${profile.years_experience}a` : '—' },
            { icon: '📍', label: 'Raio',       value: profile.work_radius_km   != null ? `${profile.work_radius_km}km` : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: '#141414', border: '1px solid #1E1E1E', borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ══ INFORMAÇÕES ══ */}
        {(profile.attendance_hours || (profile.attendance_days && profile.attendance_days.length > 0) || profile.work_radius_km != null || profile.hourly_rate_min != null || profile.hourly_rate_max != null) && (
          <div style={{ margin: '0 16px 14px', padding: 18, background: '#141414', borderRadius: 20, border: '1px solid #1E1E1E' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 16 }}>
              Informações
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

              {profile.attendance_hours && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>🕐 Horário</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{profile.attendance_hours}</span>
                </div>
              )}

              {profile.attendance_days && profile.attendance_days.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#666' }}>📆 Dias</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {profile.attendance_days.map(d => (
                      <span key={d} style={{ background: '#2A2A2A', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: '#aaa', fontWeight: 500 }}>
                        {DAY_MAP[d] ?? d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.work_radius_km != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>📍 Raio de atendimento</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{profile.work_radius_km} km</span>
                </div>
              )}

              {(profile.hourly_rate_min != null || profile.hourly_rate_max != null) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>💰 Preço médio</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFD11A' }}>
                    R$ {profile.hourly_rate_min ?? '?'}
                    {profile.hourly_rate_max != null ? `–${profile.hourly_rate_max}` : ''}/h
                  </span>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ══ SOBRE ══ */}
        {profile.bio && (
          <div style={{ margin: '0 16px 14px', padding: 18, background: '#141414', borderRadius: 20, border: '1px solid #1E1E1E' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
              Sobre
            </p>
            <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>{profile.bio}</p>
          </div>
        )}

        {/* ══ HABILIDADES ══ */}
        {profile.skills && profile.skills.length > 0 && (
          <div style={{ margin: '0 16px 14px', padding: 18, background: '#141414', borderRadius: 20, border: '1px solid #1E1E1E' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>
              Habilidades
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {profile.skills.map(skill => (
                <span key={skill} style={{
                  background: '#1E1E1E', border: '1px solid #2A2A2A',
                  borderRadius: 10, padding: '6px 13px', fontSize: 13, color: '#aaa',
                }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ══ PORTFÓLIO ══ */}
        {profile.portfolio_urls && profile.portfolio_urls.length > 0 && (
          <div style={{ margin: '0 16px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, paddingLeft: 4 }}>
              Portfólio
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, borderRadius: 18, overflow: 'hidden' }}>
              {profile.portfolio_urls.slice(0, 6).map((url, i) => (
                <div key={i} style={{ aspectRatio: '1', overflow: 'hidden', background: '#1A1A1A', position: 'relative' }}>
                  <img
                    src={url}
                    alt={`Trabalho ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ AVALIAÇÕES ══ */}
        <div style={{ margin: '0 16px 14px', padding: 18, background: '#141414', borderRadius: 20, border: '1px solid #1E1E1E' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
              Avaliações
            </p>
            {avgRating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FFD11A', lineHeight: 1 }}>{avgRating}</span>
                <Stars rating={parseFloat(avgRating)} size={16} />
                {avaliacoes.length > 0 && (
                  <span style={{ fontSize: 12, color: '#555' }}>({avaliacoes.length})</span>
                )}
              </div>
            )}
          </div>

          {avaliacoes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#444', textAlign: 'center', padding: '20px 0', margin: 0 }}>
              Nenhuma avaliação ainda
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {avaliacoes.map(av => (
                <div key={av.id} style={{ padding: 14, background: '#1A1A1A', borderRadius: 14, border: '1px solid #222' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: av.comentario ? 10 : 0 }}>
                    {av.avaliador_avatar ? (
                      <img
                        src={av.avaliador_avatar}
                        alt={av.avaliador_nome}
                        style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover', border: '1px solid #2A2A2A', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#666',
                      }}>
                        {initials(av.avaliador_nome)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#ddd', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {av.avaliador_nome}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Stars rating={av.nota} size={13} />
                        <span style={{ fontSize: 11, color: '#555' }}>{formatDate(av.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  {av.comentario && (
                    <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: 0 }}>{av.comentario}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spacer logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0 0' }}>
          <Image src="/pato-icon.svg" alt="Bikco" width={14} height={14} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 11, color: '#333', fontWeight: 600 }}>bikco<span style={{ color: '#FFD11A44' }}>.com</span></span>
        </div>
      </div>

      {/* ══ FIXED BOTTOM CTA ══ */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, zIndex: 50,
        backgroundColor: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid #1E1E1E',
        padding: '12px 16px 28px',
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={handleOrcamento}
          style={{
            flex: 1, height: 52, borderRadius: 99,
            border: '1px solid #2A2A2A',
            background: '#1A1A1A',
            color: '#ccc', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A3A'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#ccc' }}
        >
          📋 Solicitar orçamento
        </button>
        <button
          onClick={handleChat}
          style={{
            flex: 1, height: 52, borderRadius: 99, border: 'none',
            background: 'linear-gradient(135deg, #FFD11A 0%, #FF9500 100%)',
            color: '#0F0F0F', fontSize: 14, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(255,209,26,0.28)',
          }}
        >
          💬 Iniciar conversa
        </button>
      </div>

      {/* ── Auth modal ── */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onLogin={() => router.push('/login')}
          onCadastro={() => router.push('/cadastro')}
        />
      )}

      {/* ── Share toast ── */}
      {shareToast && (
        <div style={{
          position: 'fixed', top: 68, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1E1E1E', border: '1px solid #2E2E2E', borderRadius: 99,
          padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#bbb',
          zIndex: 300, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'toastIn 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          ✅ Link copiado!
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
