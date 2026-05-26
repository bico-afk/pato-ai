'use client'

import { useState } from 'react'
import SearchBar from '@/components/landing/SearchBar'
import SearchResults from '@/components/landing/SearchResults'
import LiveFeed from '@/components/landing/LiveFeed'
import { useSearch } from '@/hooks/useSearch'

/* ── SVG icons for Mission section ─────────────────────────── */
function IconSearch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IconHandshake() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l8.42 8.42 8.42-8.42a5.4 5.4 0 0 0 0-7.65z"/>
    </svg>
  )
}
function IconStar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

/* ── WhatsApp icon ──────────────────────────────────────────── */
function IconWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  )
}

/* ── Page ───────────────────────────────────────────────────── */
export default function Home() {
  const { results, loading, error, searched, search } = useSearch()
  const [lastQuery,  setLastQuery]  = useState('')
  const [lastCidade, setLastCidade] = useState('')

  function handleSearch(query: string, cidade: string) {
    setLastQuery(query)
    setLastCidade(cidade)
    search(query, cidade)
  }

  return (
    <main style={{ background: '#000', minHeight: '100dvh', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 640, margin: '0 auto', padding: '0 20px',
        paddingTop: 'clamp(48px, 10dvh, 96px)',
        paddingBottom: 40,
      }}>
        {/* Logo */}
        <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff', marginBottom: 40 }}>
          BIKCO
        </p>

        {/* Headline */}
        <h1
          className="text-[42px] sm:text-[52px] lg:text-[64px]"
          style={{
            fontWeight: 900,
            letterSpacing: '-1.5px',
            lineHeight: 1.1,
            marginBottom: 12,
            color: '#fff',
          }}
        >
          O que você precisa?
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: 'clamp(14px, 2vw, 17px)',
          color: '#475569',
          lineHeight: 1.6,
          marginBottom: 32,
          maxWidth: 480,
        }}>
          Encontre profissionais de confiança perto de você — eletricistas, pintores, faxineiras, doceiras e muito mais.
        </p>

        {/* Search bar */}
        <SearchBar onSearch={handleSearch} loading={loading} />

        {/* Search results (inline, below bar) */}
        <SearchResults
          results={results}
          loading={loading}
          error={error}
          searched={searched}
          query={lastQuery}
          cidade={lastCidade}
        />
      </section>

      {/* ── LIVE FEED ───────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #111', paddingTop: 56 }}>
        <LiveFeed />
      </section>

      {/* ── MISSION ─────────────────────────────────────────── */}
      <section style={{
        maxWidth: 900, margin: '0 auto', padding: '72px 20px',
        borderTop: '1px solid #111',
      }}>
        <h2 style={{
          fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800,
          letterSpacing: '-0.5px', color: '#fff',
          textAlign: 'center', marginBottom: 48,
        }}>
          Como funciona
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
        }}>
          {/* Col 1 */}
          <div style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12,
            padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <IconSearch />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Busque o serviço
            </h3>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
              Digite o que você precisa e sua cidade. Encontramos profissionais verificados perto de você em segundos.
            </p>
          </div>

          {/* Col 2 */}
          <div style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12,
            padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <IconHandshake />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Conecte-se direto
            </h3>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
              Sem intermediários. Fale diretamente com o profissional e combine os detalhes do serviço.
            </p>
          </div>

          {/* Col 3 */}
          <div style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12,
            padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <IconStar />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Avalie e confie
            </h3>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
              Cada profissional tem avaliações reais de quem já contratou. Comunidade que recomenda comunidade.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHATSAPP CTA ────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid #111',
        padding: '72px 20px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#00d4ff', textTransform: 'uppercase', marginBottom: 16 }}>
          PREFERE PELO WHATSAPP?
        </p>
        <h2 style={{
          fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900,
          letterSpacing: '-1px', color: '#fff',
          marginBottom: 16, lineHeight: 1.1,
        }}>
          Mande mensagem agora.
        </h2>
        <p style={{ fontSize: 15, color: '#475569', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.65 }}>
          Em 3 minutos você tem um perfil e começa a receber bicos — em qualquer idioma, de qualquer lugar do mundo.
        </p>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            height: 52, borderRadius: 10, border: 'none',
            background: '#25D366', color: '#fff',
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            padding: '0 28px', textDecoration: 'none',
            boxShadow: '0 0 0 0 rgba(37,211,102,0.4)',
            transition: 'box-shadow 0.2s, transform 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.boxShadow = '0 0 0 6px rgba(37,211,102,0.15)'
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.boxShadow = '0 0 0 0 rgba(37,211,102,0.4)'
            el.style.transform = 'translateY(0)'
          }}
        >
          <IconWhatsApp />
          Falar pelo WhatsApp
        </a>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid #111',
        padding: '32px 20px',
        maxWidth: 900, margin: '0 auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          {/* Left */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>BIKCO</p>
            <p style={{ fontSize: 12, color: '#334155', margin: '4px 0 0' }}>
              © {new Date().getFullYear()} Bikco. Todos os direitos reservados.
            </p>
          </div>

          {/* Center */}
          <p style={{ fontSize: 12, color: '#334155', textAlign: 'center' }}>
            bikco.org — organização sem fins lucrativos
          </p>

          {/* Right */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Sobre', href: '/sobre' },
              { label: 'Profissionais', href: '/feed' },
              { label: 'Privacidade', href: '/privacidade' },
              { label: 'Termos', href: '/termos' },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                style={{ fontSize: 12, color: '#334155', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </main>
  )
}
