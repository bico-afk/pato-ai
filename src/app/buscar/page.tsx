'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function IconArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
}
function IconSearch() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
}
function IconPin() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
}

interface Post {
  id: string; title: string; description: string | null; category: string | null
  city: string | null; urgency: string | null; budget_min: number | null; budget_max: number | null; created_at: string
  profiles: { full_name: string | null; city: string | null }
}

const CATEGORIES = ['Elétrica', 'Encanamento', 'Limpeza', 'Reformas', 'Pintura', 'Montagem', 'Mudança', 'Jardim', 'Informática', 'Aulas', 'Beleza', 'Pets', 'Outros']

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export default function BuscarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [results, setResults] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearch() {
    setLoading(true); setSearched(true)
    try {
      let q = supabase.from('posts')
        .select('id, title, description, category, city, urgency, budget_min, budget_max, created_at, profiles(full_name, city)')
        .eq('status', 'aberto').order('created_at', { ascending: false }).limit(30)
      if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
      if (selectedCat) q = q.ilike('category', selectedCat)
      const { data } = await q
      setResults((data as unknown as Post[]) ?? [])
    } catch { setResults([]) }
    setLoading(false)
  }

  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: '#0F0F0F', zIndex: 10, borderBottom: '1px solid #181818' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
          <button onClick={() => router.push('/feed')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <IconArrow /> voltar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>pato<span style={{ color: '#FFD11A' }}>.ai</span></span>
          </div>
          <div style={{ width: 60 }} />
        </div>
        {/* Search bar */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#444', display: 'flex' }}><IconSearch /></span>
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar bicos..."
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', height: 48, backgroundColor: '#171717', border: '1.5px solid #272727', borderRadius: 14, paddingLeft: 44, paddingRight: 16, color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => (e.target.style.borderColor = '#FFD11A')}
              onBlur={e => (e.target.style.borderColor = '#272727')}
            />
          </div>
          <button onClick={handleSearch} style={{ height: 48, padding: '0 18px', borderRadius: 14, border: 'none', backgroundColor: '#FFD11A', color: '#0F0F0F', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Buscar
          </button>
        </div>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCat(c => c === cat ? '' : cat)}
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${selectedCat === cat ? '#FFD11A' : '#272727'}`, backgroundColor: selectedCat === cat ? '#1a1500' : 'transparent', color: selectedCat === cat ? '#FFD11A' : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '12px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #222', borderTopColor: '#FFD11A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : !searched ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#666', margin: '0 0 6px' }}>Busque por bicos</p>
            <p style={{ fontSize: 14, color: '#444', margin: 0 }}>Digite um termo ou selecione uma categoria</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦆</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Nenhum resultado</p>
            <p style={{ fontSize: 14, color: '#555', margin: 0 }}>Tente outros termos ou categorias</p>
          </div>
        ) : (
          results.map(post => (
            <div key={post.id} style={{ margin: '0 12px 10px', backgroundColor: '#171717', borderRadius: 14, padding: '14px 16px' }}>
              {post.category && <span style={{ fontSize: 11, color: '#FFD11A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{post.category}</span>}
              <h3 style={{ margin: '6px 0 6px', fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>{post.title}</h3>
              {post.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.description}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {post.city && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#555', fontSize: 12 }}><IconPin />{post.city}</span>}
                {post.urgency === 'hoje' && <span style={{ backgroundColor: '#FF6B35', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>urgente</span>}
                {(post.budget_min || post.budget_max) && <span style={{ color: '#777', fontSize: 12 }}>R$ {post.budget_min}–{post.budget_max}</span>}
                <span style={{ color: '#444', fontSize: 12, marginLeft: 'auto' }}>{timeAgo(post.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
