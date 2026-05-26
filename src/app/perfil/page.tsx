'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ─────────────────────────────────────────── */
interface Profile {
  id: string
  full_name: string | null
  bio: string | null
  city: string | null
  state: string | null
  phone: string | null
  avatar_url: string | null
  cover_url: string | null
  skills: string[] | null
  score: number
  seal: string | null
  whatsapp_enabled: boolean
  search_radius: number
  is_visible: boolean
  category: string | null
}

interface Post {
  id: string
  title: string
  category: string | null
  status: string
  created_at: string
  urgency: string | null
}

interface Review {
  id: string
  nota: number
  comentario: string | null
  created_at: string
  avaliador: { full_name: string | null; avatar_url: string | null }[] | null
}

interface Stats {
  avgRating: number
  completed: number
  postCount: number
  followers: number
}

/* ─── Helpers ────────────────────────────────────────── */
function sealInfo(seal: string | null, score: number): { label: string; emoji: string; next: string } {
  if (seal === 'ouro' || score >= 51) return { label: 'Ouro', emoji: '🥇', next: 'Nível máximo!' }
  if (seal === 'prata' || score >= 11) {
    const remaining = 51 - score
    return { label: 'Prata', emoji: '🥈', next: `${remaining} trabalhos para Ouro` }
  }
  const remaining = 11 - score
  return { label: 'Bronze', emoji: '🥉', next: `${remaining} trabalhos para Prata` }
}

function scoreDisplay(score: number) {
  return Math.round((score / 100) * 1000)
}

function starRating(avg: number) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(i <= Math.round(avg) ? '★' : '☆')
  }
  return stars.join('')
}

function statusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'aberto': return { label: 'Aberto', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    case 'em_andamento': return { label: 'Em andamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    case 'concluido': return { label: 'Concluído', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
    default: return { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' }
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/* ─── Bottom Nav ─────────────────────────────────────── */
function BottomNav({ active }: { active: string }) {
  const router = useRouter()
  const items = [
    { key: 'buscar', icon: '🔍', label: 'Buscar', path: '/' },
    { key: 'feed', icon: '📋', label: 'Feed', path: '/feed' },
    { key: 'criar', icon: '➕', label: 'Criar', path: '/criar-pedido' },
    { key: 'chats', icon: '💬', label: 'Chats', path: '/conversas' },
    { key: 'perfil', icon: '👤', label: 'Perfil', path: '/perfil' },
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, background: '#1A1A1A',
      borderTop: '1px solid #2A2A2A', display: 'flex',
      zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(it => (
        <button key={it.key} onClick={() => router.push(it.path)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 2, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
          color: active === it.key ? '#FFD11A' : '#666',
          fontSize: 10, fontWeight: active === it.key ? 700 : 400,
        }}>
          <span style={{ fontSize: 20 }}>{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  )
}

/* ─── Main Page ──────────────────────────────────────── */
export default function PerfilPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({ avgRating: 0, completed: 0, postCount: 0, followers: 0 })
  const [posts, setPosts] = useState<Post[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [whatsappOn, setWhatsappOn] = useState(false)
  const [radius, setRadius] = useState(25)
  const [visible, setVisible] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const uid = session.user.id

    const [profileRes, postsRes, reviewsRes, followersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('posts').select('id,title,category,status,created_at,urgency').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
      supabase.from('avaliacoes').select('id,nota,comentario,created_at,avaliador:profiles!avaliador_id(full_name,avatar_url)').eq('avaliado_id', uid).order('created_at', { ascending: false }).limit(10),
      supabase.from('seguindo').select('id', { count: 'exact' }).eq('seguido_id', uid),
    ])

    const p = profileRes.data as Profile | null
    if (p) {
      setProfile(p)
      setWhatsappOn(p.whatsapp_enabled ?? false)
      setRadius(p.search_radius ?? 25)
      setVisible(p.is_visible ?? true)
    }

    const myPosts = (postsRes.data ?? []) as Post[]
    setPosts(myPosts)

    const myReviews = (reviewsRes.data ?? []) as Review[]
    setReviews(myReviews)

    const followerCount = followersRes.count ?? 0
    const completed = myPosts.filter(p => p.status === 'concluido').length
    const validReviews = myReviews.filter(r => r.nota >= 1 && r.nota <= 5)
    const avgRating = validReviews.length > 0
      ? validReviews.reduce((s, r) => s + r.nota, 0) / validReviews.length
      : 0

    setStats({ avgRating, completed, postCount: myPosts.length, followers: followerCount })
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    if (!profile) return
    setSavingSettings(true)
    await supabase.from('profiles').update({
      whatsapp_enabled: whatsappOn,
      search_radius: radius,
      is_visible: visible,
    }).eq('id', profile.id)
    setSavingSettings(false)
    showToast('✅ Configurações salvas')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #333', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!profile) return null

  const scoreNum = scoreDisplay(profile.score ?? 0)
  const seal = sealInfo(profile.seal, profile.score ?? 0)
  const scoreBarWidth = Math.min(100, (profile.score ?? 0))

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 100 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1A1A', border: '1px solid #333', borderRadius: 12, padding: '10px 20px',
          fontSize: 14, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1E1E1E', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 480, margin: '0 auto',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Meu Perfil</span>
        <button onClick={() => router.push('/perfil/editar')} style={{
          background: '#FFD11A', color: '#000', border: 'none', borderRadius: 20,
          padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>Editar</button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Cover + Avatar */}
        <div style={{ position: 'relative', height: 140 }}>
          <div style={{
            width: '100%', height: '100%',
            background: profile.cover_url
              ? `url(${profile.cover_url}) center/cover`
              : 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 50%, #FFD11A22 100%)',
          }} />
          {/* Avatar */}
          <div style={{ position: 'absolute', bottom: -44, left: 20 }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid #0F0F0F', overflow: 'hidden', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 32 }}>🦆</span>
              }
            </div>
            <button onClick={() => router.push('/perfil/editar')} style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: '50%',
              background: '#FFD11A', border: '2px solid #0F0F0F',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 12,
            }}>📷</button>
          </div>
        </div>

        {/* Name + city */}
        <div style={{ padding: '52px 20px 0', marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{profile.full_name ?? 'Sem nome'}</div>
          {(profile.city || profile.state) && (
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>📍 {[profile.city, profile.state].filter(Boolean).join(', ')}</div>
          )}
          {profile.bio && (
            <div style={{ fontSize: 14, color: '#bbb', marginTop: 8, lineHeight: 1.5 }}>{profile.bio}</div>
          )}
        </div>

        {/* Score Card */}
        <div style={{ margin: '20px 16px', background: '#1A1A1A', borderRadius: 16, padding: 16, border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>🦆 Score Bikco</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#FFD11A' }}>{scoreNum}</span>
          </div>

          {/* Bar */}
          <div style={{ height: 8, background: '#2A2A2A', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${scoreBarWidth}%`,
              background: scoreBarWidth < 30 ? '#ef4444' : scoreBarWidth < 70 ? '#f59e0b' : '#22c55e',
              transition: 'width 0.8s ease',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#888' }}>{seal.next}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{seal.emoji} {seal.label}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, margin: '0 16px 20px' }}>
          {[
            { icon: '⭐', value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—', label: 'Nota' },
            { icon: '✅', value: stats.completed, label: 'Feitos' },
            { icon: '📋', value: stats.postCount, label: 'Pedidos' },
            { icon: '👥', value: stats.followers, label: 'Seguidores' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1A1A1A', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: '1px solid #2A2A2A' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div style={{ margin: '0 16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Habilidades</span>
              <button onClick={() => router.push('/perfil/editar')} style={{ background: 'none', border: 'none', color: '#FFD11A', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Editar habilidades</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.skills.map(skill => (
                <span key={skill} style={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 20, padding: '6px 14px', fontSize: 13, color: '#ddd' }}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* My Posts */}
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Meus Pedidos</span>
            <button onClick={() => router.push('/criar-pedido')} style={{ background: '#FFD11A22', border: '1px solid #FFD11A44', color: '#FFD11A', fontSize: 12, fontWeight: 600, borderRadius: 20, padding: '5px 12px', cursor: 'pointer' }}>+ Novo</button>
          </div>

          {posts.length === 0 ? (
            <div style={{ background: '#1A1A1A', borderRadius: 12, padding: 20, textAlign: 'center', color: '#666', fontSize: 14, border: '1px dashed #2A2A2A' }}>
              Nenhum pedido ainda.<br />
              <span style={{ color: '#FFD11A', cursor: 'pointer' }} onClick={() => router.push('/criar-pedido')}>Criar primeiro pedido →</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {posts.map(post => {
                const badge = statusBadge(post.status)
                return (
                  <div key={post.id} style={{ background: '#1A1A1A', borderRadius: 12, padding: '12px 14px', border: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, marginRight: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{post.title}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{post.category} · {fmtDate(post.created_at)}</div>
                    </div>
                    <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap' }}>{badge.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Avaliações recebidas {reviews.length > 0 && <span style={{ color: '#888', fontWeight: 400, fontSize: 13 }}>({reviews.length})</span>}
          </div>

          {reviews.length === 0 ? (
            <div style={{ background: '#1A1A1A', borderRadius: 12, padding: 20, textAlign: 'center', color: '#666', fontSize: 14, border: '1px dashed #2A2A2A' }}>
              Ainda sem avaliações
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(r => {
                const avaliador = Array.isArray(r.avaliador) ? (r.avaliador[0] ?? null) : r.avaliador
                return (
                  <div key={r.id} style={{ background: '#1A1A1A', borderRadius: 12, padding: '12px 14px', border: '1px solid #2A2A2A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A2A2A', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {avaliador?.avatar_url
                          ? <img src={avaliador.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 14 }}>🦆</span>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{avaliador?.full_name ?? 'Usuário'}</div>
                        <div style={{ fontSize: 13, color: '#FFD11A' }}>{starRating(r.nota)}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#555' }}>{fmtDate(r.created_at)}</div>
                    </div>
                    {r.comentario && <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.4 }}>{r.comentario}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <div style={{ margin: '0 16px 24px', background: '#1A1A1A', borderRadius: 16, overflow: 'hidden', border: '1px solid #2A2A2A' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2A', fontSize: 15, fontWeight: 700, color: '#888' }}>
            Configurações
          </div>

          {/* WhatsApp toggle */}
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E1E1E' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>📱 Mostrar WhatsApp</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Exibir número no perfil público</div>
            </div>
            <button onClick={() => setWhatsappOn(v => !v)} style={{
              width: 48, height: 26, borderRadius: 13,
              background: whatsappOn ? '#25D366' : '#333',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: whatsappOn ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Radius */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E1E1E' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>📍 Raio de busca</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Distância para aparecer nas buscas</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FFD11A' }}>{radius} km</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ width: '100%', accentColor: '#FFD11A' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginTop: 4 }}>
              <span>5 km</span><span>100 km</span>
            </div>
          </div>

          {/* Visibility */}
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E1E1E' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>👁️ Perfil visível</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Aparecer nas buscas e resultados</div>
            </div>
            <button onClick={() => setVisible(v => !v)} style={{
              width: 48, height: 26, borderRadius: 13,
              background: visible ? '#FFD11A' : '#333',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: visible ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Save settings */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E1E1E' }}>
            <button onClick={saveSettings} disabled={savingSettings} style={{
              width: '100%', padding: '12px 0', background: '#FFD11A', color: '#000',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: savingSettings ? 'default' : 'pointer', opacity: savingSettings ? 0.7 : 1,
            }}>
              {savingSettings ? 'Salvando…' : 'Salvar configurações'}
            </button>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            width: '100%', padding: '16px', background: 'none', border: 'none',
            color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            🚪 Sair da conta
          </button>
        </div>

      </div>

      <BottomNav active="perfil" />
    </div>
  )
}
