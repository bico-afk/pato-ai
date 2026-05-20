'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  cover_url: string | null
  city: string | null
  state: string | null
  bio: string | null
  seal: string | null
  score: number | null
  skills: string[] | null
  concluidos: number | null
  phone: string | null
  whatsapp: string | null
}

interface Post {
  id: string
  title: string
  status: string
  urgency: string | null
  media_urls: string[] | null
  created_at: string
}

interface Avaliacao {
  id: string
  nota: number
  comentario: string | null
  created_at: string
  avaliador_id: string
  avaliador: { full_name: string | null; avatar_url: string | null } | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const AVATAR_COLORS = ['#E74C3C','#9B59B6','#3498DB','#1ABC9C','#F39C12','#E67E22','#2ECC71','#E91E8C']
function avatarColor(n: string) { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n: string) { return (n || '?').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() }

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`
  return `${Math.floor(d / 30)}m`
}

const SEAL_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  ouro:   { label: 'OURO',   color: '#FFD11A', emoji: '🥇' },
  prata:  { label: 'PRATA',  color: '#C0C0C0', emoji: '🥈' },
  bronze: { label: 'BRONZE', color: '#CD7F32', emoji: '🥉' },
}

const STATUS_POST: Record<string, { label: string; color: string }> = {
  aberto:  { label: 'Aberto',   color: '#22C55E' },
  fechado: { label: 'Fechado',  color: '#888' },
  pausado: { label: 'Pausado',  color: '#FF7A1A' },
}

/* ─── Components ─────────────────────────────────────────── */
function Avatar({ src, name, size = 40 }: { src: string | null; name: string | null; size?: number }) {
  const n = name || '?'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: avatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(n)}
    </div>
  )
}

function Stars({ nota }: { nota: number }) {
  return (
    <span style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= nota ? '#FFD11A' : '#333'} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

/* ─── Main ───────────────────────────────────────────────── */
export default function PerfilPage() {
  const router   = useRouter()
  const params   = useParams()
  const profileId = params.id as string
  const supabase = createClient()

  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [posts,         setPosts]         = useState<Post[]>([])
  const [avaliacoes,    setAvaliacoes]    = useState<Avaliacao[]>([])
  const [userId,        setUserId]        = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [followersCount,setFollowersCount] = useState(0)
  const [followingCount,setFollowingCount] = useState(0)
  const [isFollowing,   setIsFollowing]   = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showAllReviews,setShowAllReviews] = useState(false)
  const [showMenu,      setShowMenu]      = useState(false)
  const [concluidos,    setConcluidos]    = useState(0)

  const isOwn = userId === profileId

  const load = useCallback(async (uid: string) => {
    /* Profile */
    const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single()
    if (!p) { router.replace('/feed'); return }
    setProfile(p as Profile)

    /* Posts recentes */
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, title, status, urgency, media_urls, created_at')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(6)
    if (postsData) setPosts(postsData as Post[])

    /* Avaliações */
    const { data: avData } = await supabase
      .from('avaliacoes')
      .select('id, nota, comentario, created_at, avaliador_id')
      .eq('avaliado_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (avData?.length) {
      // Fetch avaliador profiles
      const ids = [...new Set(avData.map(a => a.avaliador_id))]
      const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      const profMap = Object.fromEntries((profs ?? []).map(pr => [pr.id, pr]))
      setAvaliacoes(avData.map(a => ({ ...a, avaliador: profMap[a.avaliador_id] ?? null })) as Avaliacao[])
    }

    /* Bicos concluídos */
    const { count: concCount } = await supabase
      .from('candidaturas')
      .select('id', { count: 'exact', head: true })
      .eq('prestador_id', profileId)
      .eq('status', 'confirmada')
    setConcluidos(concCount ?? (p as Profile).concluidos ?? 0)

    /* Followers / following */
    const [{ count: fwers }, { count: fwing }] = await Promise.all([
      supabase.from('seguindo').select('id', { count: 'exact', head: true }).eq('seguido_id', profileId),
      supabase.from('seguindo').select('id', { count: 'exact', head: true }).eq('seguidor_id', profileId),
    ])
    setFollowersCount(fwers ?? 0)
    setFollowingCount(fwing ?? 0)

    /* Is following? */
    if (uid !== profileId) {
      const { data: fRow } = await supabase.from('seguindo').select('id').eq('seguidor_id', uid).eq('seguido_id', profileId).maybeSingle()
      setIsFollowing(!!fRow)
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      load(data.user.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  /* ── Follow / Unfollow ── */
  async function toggleFollow() {
    if (!userId || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('seguindo').delete().eq('seguidor_id', userId).eq('seguido_id', profileId)
      setIsFollowing(false)
      setFollowersCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('seguindo').insert({ seguidor_id: userId, seguido_id: profileId })
      setIsFollowing(true)
      setFollowersCount(c => c + 1)
      // Notify
      await supabase.from('notificacoes').insert({
        user_id: profileId,
        tipo: 'novo_seguidor',
        titulo: '👤 Novo seguidor',
        mensagem: `${profile?.full_name || 'Alguém'} começou a te seguir.`,
        link: `/perfil/${userId}`,
        lida: false,
      }).then(() => {})
    }
    setFollowLoading(false)
  }

  /* ── Seal calc ── */
  function getSeal(n: number): string | null {
    if (n >= 51) return 'ouro'
    if (n >= 11) return 'prata'
    if (n >= 1)  return 'bronze'
    return null
  }

  /* ── Average score ── */
  const avgScore = avaliacoes.length
    ? Math.round((avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length) * 10) / 10
    : (profile?.score ? profile.score / 20 : 0)

  /* ── Loading ── */
  if (loading) return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!profile) return null

  const seal = profile.seal ?? getSeal(concluidos)
  const sealInfo = seal ? SEAL_INFO[seal] : null
  const displayedReviews = showAllReviews ? avaliacoes : avaliacoes.slice(0, 3)

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>

      {/* ─── Header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0F0F0F', borderBottom: '1px solid #1a1a1a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isOwn ? (
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
        ) : <div style={{ width: 28 }} />}

        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Perfil</span>

        {isOwn ? (
          <button onClick={() => router.push('/perfil/editar')} style={{ background: 'none', border: '1px solid #FFD11A', borderRadius: 8, color: '#FFD11A', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '5px 12px' }}>
            Editar
          </button>
        ) : (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(s => !s)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>
              •••
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: 32, backgroundColor: '#1e1e1e', borderRadius: 10, border: '1px solid #2a2a2a', minWidth: 160, zIndex: 30, overflow: 'hidden' }}>
                {[
                  { label: '🔗 Compartilhar', action: () => { navigator.share?.({ url: window.location.href }).catch(()=>{}); setShowMenu(false) } },
                  { label: '🚩 Reportar', action: () => { alert('Obrigado pelo reporte.'); setShowMenu(false) } },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#ccc', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Cover ─── */}
      <div style={{ position: 'relative', height: 120 }}>
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1200 0%, #2a1800 50%, #1a0800 100%)' }}>
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FFD11A11, #FF7A1A22, transparent)' }} />
          </div>
        )}

        {/* Avatar (positioned overlapping cover) */}
        <div style={{ position: 'absolute', bottom: -44, left: '50%', transform: 'translateX(-50%)', width: 88, height: 88, borderRadius: '50%', border: '3px solid #FFD11A', overflow: 'hidden', backgroundColor: avatarColor(profile.full_name || '?') }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>
              {initials(profile.full_name || '?')}
            </div>
          )}
        </div>
      </div>

      {/* ─── Name / location / seal ─── */}
      <div style={{ marginTop: 52, textAlign: 'center', padding: '0 16px 16px' }}>
        {sealInfo && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: sealInfo.color, border: `1px solid ${sealInfo.color}55`, borderRadius: 20, padding: '3px 12px' }}>
              {sealInfo.emoji} {sealInfo.label}
            </span>
          </div>
        )}
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          {profile.full_name || 'Usuário'}
        </h1>
        {(profile.city || profile.state) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: '#666', fontSize: 13 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#666"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            {[profile.city, profile.state].filter(Boolean).join(', ')}
          </div>
        )}
      </div>

      {/* ─── Stats card ─── */}
      <div style={{ margin: '0 16px 16px', backgroundColor: '#171717', borderRadius: 14, border: '1px solid #222', overflow: 'hidden', display: 'flex' }}>
        {[
          { label: 'Avaliação', value: avgScore > 0 ? avgScore.toFixed(1) : '—', sub: '⭐' },
          { label: 'Bicos', value: concluidos, sub: '✅' },
          { label: 'Seguidores', value: followersCount, sub: '👥' },
          { label: 'Seguindo', value: followingCount, sub: '👤' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: '14px 6px', textAlign: 'center', borderRight: i < 3 ? '1px solid #222' : 'none' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#555' }}>{s.sub}</p>
            <p style={{ margin: '2px 0', fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: '#555', lineHeight: 1.2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ─── Follow button (other profiles) ─── */}
      {!isOwn && (
        <div style={{ margin: '0 16px 16px', display: 'flex', gap: 10 }}>
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            style={{ flex: 1, height: 44, borderRadius: 12, border: isFollowing ? '1.5px solid #FFD11A' : 'none', backgroundColor: isFollowing ? 'transparent' : '#FFD11A', color: isFollowing ? '#FFD11A' : '#0F0F0F', fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', opacity: followLoading ? 0.6 : 1 }}
          >
            {followLoading ? '...' : isFollowing ? 'Seguindo ✓' : 'Seguir'}
          </button>
          <button
            onClick={() => router.push(`/chat/new?with=${profileId}`)}
            style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid #272727', backgroundColor: 'transparent', color: '#888', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            💬
          </button>
        </div>
      )}

      {/* ─── Edit / Logout buttons (own profile) ─── */}
      {isOwn && (
        <div style={{ margin: '0 16px 16px', display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/perfil/editar')} style={{ flex: 1, height: 42, borderRadius: 12, border: '1px solid #272727', backgroundColor: 'transparent', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✏️ Editar perfil
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }} style={{ height: 42, borderRadius: 12, border: '1px solid #2a1010', backgroundColor: 'transparent', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 14px' }}>
            Sair
          </button>
        </div>
      )}

      {/* ─── Bio ─── */}
      <div style={{ margin: '0 16px 16px' }}>
        {profile.bio ? (
          <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.65 }}>{profile.bio}</p>
        ) : isOwn ? (
          <button onClick={() => router.push('/perfil/editar')} style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            + Adicione uma bio para se apresentar →
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#444', fontStyle: 'italic' }}>Sem bio ainda</p>
        )}
      </div>

      {/* ─── Skills ─── */}
      {profile.skills && profile.skills.length > 0 && (
        <div style={{ margin: '0 16px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Habilidades</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profile.skills.map(skill => (
              <span key={skill} style={{ fontSize: 12, color: '#bbb', backgroundColor: '#272727', borderRadius: 20, padding: '4px 12px' }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Avaliações ─── */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>
            Avaliações {avaliacoes.length > 0 && `(${avaliacoes.length})`}
          </p>
          {avgScore > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FFD11A' }}>⭐ {avgScore.toFixed(1)}</span>
          )}
        </div>

        {avaliacoes.length === 0 ? (
          <div style={{ backgroundColor: '#171717', borderRadius: 12, padding: '20px 16px', textAlign: 'center', border: '1px solid #222' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#555' }}>Nenhuma avaliação ainda</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayedReviews.map(av => (
              <div key={av.id} style={{ backgroundColor: '#171717', borderRadius: 12, padding: '14px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar src={av.avaliador?.avatar_url ?? null} name={av.avaliador?.full_name ?? null} size={36} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{av.avaliador?.full_name || 'Usuário'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Stars nota={av.nota} />
                      <span style={{ fontSize: 10, color: '#555' }}>{timeAgo(av.created_at)}</span>
                    </div>
                  </div>
                </div>
                {av.comentario && (
                  <p style={{ margin: 0, fontSize: 13, color: '#aaa', lineHeight: 1.55 }}>&ldquo;{av.comentario}&rdquo;</p>
                )}
              </div>
            ))}

            {avaliacoes.length > 3 && (
              <button
                onClick={() => setShowAllReviews(s => !s)}
                style={{ background: 'none', border: '1px solid #272727', borderRadius: 10, padding: '10px', color: '#888', fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
              >
                {showAllReviews ? 'Ver menos' : `Ver todas as ${avaliacoes.length} avaliações`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Posts recentes ─── */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>
            Bicos postados {posts.length > 0 && `(${posts.length})`}
          </p>
          {posts.length > 4 && (
            <button onClick={() => router.push(`/usuario/${profileId}`)} style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Ver todos
            </button>
          )}
        </div>

        {posts.length === 0 ? (
          <div style={{ backgroundColor: '#171717', borderRadius: 12, padding: '20px 16px', textAlign: 'center', border: '1px solid #222' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
              {isOwn ? 'Você ainda não postou nenhum bico' : 'Nenhum bico postado ainda'}
            </p>
            {isOwn && (
              <button onClick={() => router.push('/criar-post')} style={{ marginTop: 10, backgroundColor: '#FFD11A', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Criar post
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {posts.slice(0, 4).map(post => {
              const statusInfo = STATUS_POST[post.status] ?? STATUS_POST.aberto
              const thumb = post.media_urls?.[0]
              return (
                <div
                  key={post.id}
                  onClick={() => router.push(`/post/${post.id}`)}
                  style={{ backgroundColor: '#171717', borderRadius: 12, overflow: 'hidden', border: '1px solid #222', cursor: 'pointer', transition: 'border-color 0.15s' }}
                >
                  {thumb ? (
                    <div style={{ height: 80, overflow: 'hidden' }}>
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ height: 60, backgroundColor: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🦆</div>
                  )}
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusInfo.color }}>● {statusInfo.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dismiss menu overlay */}
      {showMenu && <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
