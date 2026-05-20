'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Types ──────────────────────────────────────────────── */
interface Post {
  id: string
  title: string
  description: string | null
  category: string | null
  city: string | null
  state: string | null
  urgency: string | null
  budget: number | null
  status: string
  created_at: string
  user_id: string
  photo_url: string | null
  author_name: string | null
  author_avatar: string | null
}

interface Profile {
  id: string
  full_name: string | null
  city: string | null
  bio: string | null
  avatar_url: string | null
  concluidos: number | null
  skills: string[] | null
  rating_avg: number | null
}

interface Filters {
  category: string
  urgency: string
  city: string
  budgetMin: number
  budgetMax: number
  radius: string
}

type ResultTab = 'bicos' | 'pessoas'
type SortKey = 'relevancia' | 'recente' | 'menor_preco' | 'urgencia'

/* ─── Constants ──────────────────────────────────────────── */
const CATEGORIES = [
  { icon: '⚡', name: 'Elétrica' },
  { icon: '🔧', name: 'Encanamento' },
  { icon: '🧹', name: 'Limpeza' },
  { icon: '🏗️', name: 'Reformas' },
  { icon: '🎨', name: 'Pintura' },
  { icon: '📦', name: 'Montagem' },
  { icon: '🚚', name: 'Mudança' },
  { icon: '🌿', name: 'Jardim' },
  { icon: '💻', name: 'Informática' },
  { icon: '📚', name: 'Aulas' },
  { icon: '✂️', name: 'Beleza' },
  { icon: '🐾', name: 'Pets' },
  { icon: '🖌️', name: 'Design' },
  { icon: '🍳', name: 'Culinária' },
  { icon: '➕', name: 'Outros' },
]

const URGENCY_OPTS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'essa_semana', label: 'Essa semana' },
  { value: 'sem_pressa', label: 'Sem pressa' },
]

const RADIUS_OPTS = ['5km', '10km', '25km', '50km', 'qualquer']

const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: 'relevancia', label: 'Relevância' },
  { key: 'recente', label: 'Mais recente' },
  { key: 'menor_preco', label: 'Menor preço' },
  { key: 'urgencia', label: 'Urgência' },
]

const DEFAULT_FILTERS: Filters = {
  category: '',
  urgency: '',
  city: '',
  budgetMin: 0,
  budgetMax: 5000,
  radius: 'qualquer',
}

const HISTORY_KEY = 'pato_search_history'
const MAX_HISTORY = 8

/* ─── Helpers ────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 3600) return 'agora'
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getSeal(n: number | null) {
  if (!n) return null
  if (n >= 51) return '🥇'
  if (n >= 11) return '🥈'
  if (n >= 1) return '🥉'
  return null
}

function urgencyLabel(u: string | null) {
  if (u === 'hoje') return { text: 'Urgente', color: '#FF4444' }
  if (u === 'essa_semana') return { text: 'Essa semana', color: '#FF9500' }
  return null
}

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(term: string) {
  const hist = loadHistory().filter(h => h !== term)
  hist.unshift(term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)))
}

function removeHistory(term: string) {
  const hist = loadHistory().filter(h => h !== term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
}

/* ─── Page ───────────────────────────────────────────────── */
export default function BuscaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [urgentPosts, setUrgentPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<ResultTab>('bicos')
  const [sort, setSort] = useState<SortKey>('relevancia')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [followSet, setFollowSet] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* focus on mount */
  useEffect(() => { inputRef.current?.focus() }, [])

  /* load history */
  useEffect(() => { setHistory(loadHistory()) }, [])

  /* load urgent posts + current user */
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: fol } = await supabase
          .from('seguindo')
          .select('seguido_id')
          .eq('seguidor_id', user.id)
        if (fol) setFollowSet(new Set(fol.map((f: { seguido_id: string }) => f.seguido_id)))
      }

      const { data } = await supabase
        .from('posts')
        .select('id,title,description,category,city,state,urgency,budget,status,created_at,user_id,photo_url')
        .eq('urgency', 'hoje')
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) {
        const enriched = await enrichPosts(data as Post[])
        setUrgentPosts(enriched)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* debounce query */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  /* search */
  useEffect(() => {
    if (!debouncedQ) { setPosts([]); setProfiles([]); return }
    doSearch(debouncedQ, filters, sort)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters, sort])

  /* ── helpers ── */
  const enrichPosts = useCallback(async (raw: Post[]): Promise<Post[]> => {
    if (!raw.length) return []
    const ids = [...new Set(raw.map(p => p.user_id))]
    const { data: profs } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url')
      .in('id', ids)
    const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
    for (const p of (profs ?? [])) map[p.id] = p
    return raw.map(p => ({
      ...p,
      author_name: map[p.user_id]?.full_name ?? null,
      author_avatar: map[p.user_id]?.avatar_url ?? null,
    }))
  }, [supabase])

  const doSearch = useCallback(async (q: string, f: Filters, s: SortKey) => {
    setLoading(true)
    try {
      /* posts */
      let postsQ = supabase
        .from('posts')
        .select('id,title,description,category,city,state,urgency,budget,status,created_at,user_id,photo_url')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,city.ilike.%${q}%`)
        .eq('status', 'aberto')
        .limit(40)

      if (f.category) postsQ = postsQ.ilike('category', `%${f.category}%`)
      if (f.urgency) postsQ = postsQ.eq('urgency', f.urgency)
      if (f.city) postsQ = postsQ.ilike('city', `%${f.city}%`)
      if (f.budgetMax < 5000) postsQ = postsQ.lte('budget', f.budgetMax)
      if (f.budgetMin > 0) postsQ = postsQ.gte('budget', f.budgetMin)

      /* sort */
      if (s === 'recente') postsQ = postsQ.order('created_at', { ascending: false })
      else if (s === 'menor_preco') postsQ = postsQ.order('budget', { ascending: true, nullsFirst: false })
      else if (s === 'urgencia') postsQ = postsQ.order('urgency', { ascending: true })
      else postsQ = postsQ.order('created_at', { ascending: false })

      const { data: rawPosts } = await postsQ
      const enriched = await enrichPosts((rawPosts ?? []) as Post[])
      setPosts(enriched)

      /* profiles */
      const { data: rawProfiles } = await supabase
        .from('profiles')
        .select('id,full_name,city,bio,avatar_url,concluidos,skills')
        .or(`full_name.ilike.%${q}%,city.ilike.%${q}%,bio.ilike.%${q}%`)
        .limit(20)

      setProfiles((rawProfiles ?? []) as Profile[])
    } finally {
      setLoading(false)
    }
  }, [supabase, enrichPosts])

  /* ── actions ── */
  function handleSearch(term: string) {
    const t = term.trim()
    if (!t) return
    saveHistory(t)
    setHistory(loadHistory())
    setQuery(t)
  }

  function clearQuery() { setQuery(''); setPosts([]); setProfiles([]) }

  function handleCategoryClick(cat: string) { handleSearch(cat) }

  async function toggleFollow(profileId: string) {
    if (!userId) { router.push('/login'); return }
    if (followSet.has(profileId)) {
      await supabase.from('seguindo').delete()
        .eq('seguidor_id', userId).eq('seguido_id', profileId)
      setFollowSet(prev => { const s = new Set(prev); s.delete(profileId); return s })
    } else {
      await supabase.from('seguindo').insert({ seguidor_id: userId, seguido_id: profileId })
      setFollowSet(prev => new Set(prev).add(profileId))
    }
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setShowFilters(false)
  }

  function clearFilters() {
    setPendingFilters(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
  }

  const hasActiveFilters =
    filters.category !== '' || filters.urgency !== '' || filters.city !== '' ||
    filters.budgetMin > 0 || filters.budgetMax < 5000 || filters.radius !== 'qualquer'

  /* ── suggestion lists ── */
  const suggestedCats = CATEGORIES.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) && query.length > 0
  )
  const suggestedPosts = posts.slice(0, 4)
  const suggestedProfiles = profiles.slice(0, 3)
  const isSuggesting = query.length > 0 && query.trim() === '' || (query.length > 0 && !debouncedQ)
  const isSearching = query.length > 0 && loading
  const hasResults = debouncedQ.length > 0 && !loading

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0F0F0F',
      fontFamily: 'Inter, sans-serif',
      color: '#fff',
      maxWidth: 480,
      margin: '0 auto',
      paddingBottom: 80,
    }}>

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0F0F0F',
        padding: '16px 16px 12px',
        borderBottom: '1px solid #1E1E1E',
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: 20,
          textAlign: 'center',
          marginBottom: 12,
        }}>
          Buscar
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: '#171717',
            borderRadius: 14,
            height: 52,
            padding: '0 14px',
            gap: 10,
            border: '1px solid #2A2A2A',
          }}>
            <span style={{ fontSize: 18, color: '#555', flexShrink: 0 }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(query) }}
              placeholder="Buscar bicos, categorias, pessoas..."
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 15,
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {query && (
              <button onClick={clearQuery} style={{
                background: 'none', border: 'none', color: '#555', cursor: 'pointer',
                fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0,
              }}>✕</button>
            )}
          </div>

          {/* Filters button */}
          <button
            onClick={() => { setPendingFilters(filters); setShowFilters(true) }}
            style={{
              background: hasActiveFilters ? '#FFD11A' : '#1E1E1E',
              border: 'none',
              borderRadius: 14,
              height: 52,
              width: 52,
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {hasActiveFilters ? (
              <span style={{ fontSize: 16 }}>🎛️</span>
            ) : (
              <span style={{ fontSize: 16 }}>⚙️</span>
            )}
          </button>
        </div>
      </div>

      {/* ── INITIAL STATE ── */}
      {!query && (
        <div>
          {/* Histórico */}
          {history.length > 0 && (
            <div style={{ padding: '20px 16px 0' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Buscas recentes</span>
                <button
                  onClick={() => { localStorage.setItem(HISTORY_KEY, '[]'); setHistory([]) }}
                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
                >Limpar</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {history.map(h => (
                  <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => handleSearch(h)}
                      style={{
                        background: '#1A1A1A',
                        border: '1px solid #2A2A2A',
                        borderRadius: 20,
                        color: '#ccc',
                        padding: '5px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >🕐 {h}</button>
                    <button
                      onClick={() => { removeHistory(h); setHistory(loadHistory()) }}
                      style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 13 }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categorias */}
          <div style={{ padding: '24px 16px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              Explorar por categoria
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  style={{
                    background: '#171717',
                    border: '1px solid #222',
                    borderRadius: 12,
                    padding: '14px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#212121')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#171717')}
                >
                  <span style={{ fontSize: 26 }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, color: '#ccc', fontWeight: 500 }}>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Urgentes */}
          {urgentPosts.length > 0 && (
            <div style={{ padding: '28px 16px 0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
                🔥 Bicos urgentes perto de você
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {urgentPosts.map(p => (
                  <PostCard key={p.id} post={p} onClick={() => router.push(`/bico/${p.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOADING ── */}
      {query && loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 14 }}>
          Buscando...
        </div>
      )}

      {/* ── SUGGESTIONS (typing, before debounce fires) ── */}
      {query && !loading && !hasResults && (
        <div style={{ padding: '8px 0' }}>
          {suggestedCats.length > 0 && (
            <>
              <SectionLabel>Categorias</SectionLabel>
              {suggestedCats.map(c => (
                <SuggestionRow key={c.name} icon={c.icon} text={c.name} onClick={() => handleSearch(c.name)} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── RESULTS ── */}
      {hasResults && (
        <div>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #1E1E1E',
            position: 'sticky',
            top: 116,
            zIndex: 40,
            background: '#0F0F0F',
          }}>
            {(['bicos', 'pessoas'] as ResultTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid #FFD11A' : '2px solid transparent',
                  color: tab === t ? '#FFD11A' : '#666',
                  fontWeight: tab === t ? 700 : 400,
                  fontSize: 14,
                  padding: '12px 0',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'bicos' ? `Bicos (${posts.length})` : `Pessoas (${profiles.length})`}
              </button>
            ))}
          </div>

          {/* Sort (bicos only) */}
          {tab === 'bicos' && (
            <div style={{
              overflowX: 'auto',
              scrollbarWidth: 'none',
              display: 'flex',
              gap: 8,
              padding: '10px 16px',
            }}>
              {SORT_OPTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  style={{
                    flexShrink: 0,
                    background: sort === s.key ? '#FFD11A' : '#1E1E1E',
                    color: sort === s.key ? '#0F0F0F' : '#aaa',
                    border: 'none',
                    borderRadius: 20,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: sort === s.key ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >{s.label}</button>
              ))}
            </div>
          )}

          {/* Tab: Bicos */}
          {tab === 'bicos' && (
            <div style={{ padding: '4px 16px 0' }}>
              {posts.length === 0 ? (
                <EmptyResults query={debouncedQ} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {posts.map(p => (
                    <PostCard key={p.id} post={p} onClick={() => router.push(`/bico/${p.id}`)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Pessoas */}
          {tab === 'pessoas' && (
            <div style={{ padding: '4px 0 0' }}>
              {profiles.length === 0 ? (
                <EmptyResults query={debouncedQ} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {profiles.map((p, idx) => (
                    <PersonCard
                      key={p.id}
                      profile={p}
                      isLast={idx === profiles.length - 1}
                      following={followSet.has(p.id)}
                      isSelf={p.id === userId}
                      onFollow={() => toggleFollow(p.id)}
                      onClick={() => router.push(`/perfil/${p.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FILTERS MODAL ── */}
      {showFilters && (
        <>
          <div
            onClick={() => setShowFilters(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 480,
            background: '#141414',
            borderRadius: '20px 20px 0 0',
            zIndex: 101,
            padding: '20px 16px 32px',
            maxHeight: '85dvh',
            overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2, background: '#333',
              margin: '0 auto 20px',
            }} />

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20,
            }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Filtros</span>
              <button onClick={clearFilters} style={{
                background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>Limpar tudo</button>
            </div>

            {/* Categoria */}
            <FilterSection label="Categoria">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setPendingFilters(f => ({
                      ...f, category: f.category === c.name ? '' : c.name,
                    }))}
                    style={{
                      background: pendingFilters.category === c.name ? '#FFD11A' : '#1E1E1E',
                      color: pendingFilters.category === c.name ? '#0F0F0F' : '#ccc',
                      border: 'none', borderRadius: 20, padding: '6px 12px',
                      fontSize: 13, cursor: 'pointer', fontWeight: pendingFilters.category === c.name ? 700 : 400,
                    }}
                  >{c.icon} {c.name}</button>
                ))}
              </div>
            </FilterSection>

            {/* Urgência */}
            <FilterSection label="Urgência">
              <div style={{ display: 'flex', gap: 8 }}>
                {URGENCY_OPTS.map(u => (
                  <button
                    key={u.value}
                    onClick={() => setPendingFilters(f => ({
                      ...f, urgency: f.urgency === u.value ? '' : u.value,
                    }))}
                    style={{
                      flex: 1,
                      background: pendingFilters.urgency === u.value ? '#FFD11A' : '#1E1E1E',
                      color: pendingFilters.urgency === u.value ? '#0F0F0F' : '#ccc',
                      border: 'none', borderRadius: 10, padding: '10px 4px',
                      fontSize: 13, cursor: 'pointer', fontWeight: pendingFilters.urgency === u.value ? 700 : 400,
                    }}
                  >{u.label}</button>
                ))}
              </div>
            </FilterSection>

            {/* Orçamento */}
            <FilterSection label={`Orçamento: R$ ${pendingFilters.budgetMin} – R$ ${pendingFilters.budgetMax === 5000 ? '5000+' : pendingFilters.budgetMax}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12, color: '#888' }}>Mínimo</label>
                <input
                  type="range" min={0} max={5000} step={50}
                  value={pendingFilters.budgetMin}
                  onChange={e => setPendingFilters(f => ({ ...f, budgetMin: Number(e.target.value) }))}
                  style={{ accentColor: '#FFD11A', width: '100%' }}
                />
                <label style={{ fontSize: 12, color: '#888' }}>Máximo</label>
                <input
                  type="range" min={0} max={5000} step={50}
                  value={pendingFilters.budgetMax}
                  onChange={e => setPendingFilters(f => ({ ...f, budgetMax: Number(e.target.value) }))}
                  style={{ accentColor: '#FFD11A', width: '100%' }}
                />
              </div>
            </FilterSection>

            {/* Cidade */}
            <FilterSection label="Cidade">
              <input
                value={pendingFilters.city}
                onChange={e => setPendingFilters(f => ({ ...f, city: e.target.value }))}
                placeholder="Ex: São Paulo"
                style={{
                  width: '100%', background: '#1E1E1E', border: '1px solid #2A2A2A',
                  borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14,
                  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                }}
              />
            </FilterSection>

            {/* Raio */}
            <FilterSection label="Raio de distância">
              <div style={{ display: 'flex', gap: 8 }}>
                {RADIUS_OPTS.map(r => (
                  <button
                    key={r}
                    onClick={() => setPendingFilters(f => ({ ...f, radius: r }))}
                    style={{
                      flex: 1,
                      background: pendingFilters.radius === r ? '#FFD11A' : '#1E1E1E',
                      color: pendingFilters.radius === r ? '#0F0F0F' : '#ccc',
                      border: 'none', borderRadius: 10, padding: '9px 2px',
                      fontSize: 12, cursor: 'pointer', fontWeight: pendingFilters.radius === r ? 700 : 400,
                    }}
                  >{r}</button>
                ))}
              </div>
            </FilterSection>

            <button
              onClick={applyFilters}
              style={{
                width: '100%', background: '#FFD11A', border: 'none', borderRadius: 14,
                padding: '16px', color: '#0F0F0F', fontWeight: 700, fontSize: 16,
                cursor: 'pointer', marginTop: 8,
              }}
            >Aplicar filtros</button>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Sub-components ─────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </div>
  )
}

function SuggestionRow({ icon, text, onClick }: { icon: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #1A1A1A',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', color: '#fff', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 15 }}>{text}</span>
    </button>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#ccc', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const urg = urgencyLabel(post.urgency)
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: '#141414', border: '1px solid #1E1E1E',
        borderRadius: 14, padding: '14px', cursor: 'pointer', textAlign: 'left',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      {post.photo_url && (
        <img
          src={post.photo_url}
          alt=""
          style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 15, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
        }}>
          {post.title}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
          {[post.city, post.state].filter(Boolean).join(', ') || 'Sem local'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {post.budget && (
            <span style={{ fontSize: 13, color: '#FFD11A', fontWeight: 700 }}>
              R$ {post.budget.toLocaleString('pt-BR')}
            </span>
          )}
          {urg && (
            <span style={{
              background: urg.color + '22', color: urg.color,
              borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>{urg.text}</span>
          )}
          {post.category && (
            <span style={{ fontSize: 11, color: '#666' }}>{post.category}</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#555', flexShrink: 0, marginTop: 2 }}>
        {timeAgo(post.created_at)}
      </div>
    </button>
  )
}

function PersonCard({
  profile, isLast, following, isSelf, onFollow, onClick,
}: {
  profile: Profile
  isLast: boolean
  following: boolean
  isSelf: boolean
  onFollow: () => void
  onClick: () => void
}) {
  const seal = getSeal(profile.concluidos)
  return (
    <div style={{
      borderBottom: isLast ? 'none' : '1px solid #1A1A1A',
      padding: '14px 16px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#1E1E1E', overflow: 'hidden',
        }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🦆</div>
          )}
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
              {profile.full_name ?? 'Usuário'}
            </span>
            {seal && <span style={{ fontSize: 14 }}>{seal}</span>}
          </div>
          {profile.city && (
            <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>📍 {profile.city}</div>
          )}
          {profile.bio && (
            <div style={{
              fontSize: 12, color: '#888',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 6,
            }}>{profile.bio}</div>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
              {profile.skills.slice(0, 3).map(s => (
                <span key={s} style={{
                  background: '#1A1A1A', borderRadius: 6, padding: '2px 8px',
                  fontSize: 11, color: '#888',
                }}>{s}</span>
              ))}
              {profile.skills.length > 3 && (
                <span style={{ fontSize: 11, color: '#666' }}>+{profile.skills.length - 3}</span>
              )}
            </div>
          )}
        </button>
      </div>

      {!isSelf && (
        <button
          onClick={e => { e.stopPropagation(); onFollow() }}
          style={{
            background: following ? 'transparent' : '#FFD11A',
            border: following ? '1px solid #444' : 'none',
            borderRadius: 20,
            padding: '6px 14px',
            color: following ? '#888' : '#0F0F0F',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >{following ? 'Seguindo' : 'Seguir'}</button>
      )}
    </div>
  )
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div style={{
      padding: '60px 32px', textAlign: 'center', display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>🦆</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
        Nenhum resultado para &quot;{query}&quot;
      </div>
      <div style={{ color: '#666', fontSize: 14, lineHeight: 1.5, maxWidth: 260 }}>
        Tente outras palavras ou explore as categorias
      </div>
    </div>
  )
}
