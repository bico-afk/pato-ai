'use client'

import { useLanding } from './LandingProvider'

interface Testi { name: string; role: string; city: string; flag: string; quote: string; tone: 'amber' | 'cyan' }

/* 24 relatos — pessoas do mundo todo (reforça o alcance global da Bikco). */
const TESTIMONIALS: Testi[] = [
  { name: 'Mariana Alves',  role: 'Diarista',        city: 'São Paulo, BR',     flag: '🇧🇷', tone: 'amber', quote: 'Fechei 3 faxinas na primeira semana. Nunca foi tão fácil arrumar trabalho.' },
  { name: 'Carlos Pereira', role: 'Eletricista',     city: 'Lisboa, PT',         flag: '🇵🇹', tone: 'cyan',  quote: 'Recebo pedidos da minha região todo dia. A grana extra virou minha renda principal.' },
  { name: 'Aisha Bello',    role: 'Faz fretes',      city: 'Lagos, NG',          flag: '🇳🇬', tone: 'amber', quote: 'I describe what I do and clients find me. No fees, no fuss. Brilliant.' },
  { name: 'Lucas Martins',  role: 'Montador',        city: 'Taubaté, BR',        flag: '🇧🇷', tone: 'cyan',  quote: 'Montei 12 guarda-roupas esse mês só pela Bikco. De graça pra começar, sério!' },
  { name: 'Sofía Gómez',    role: 'Profesora',       city: 'Bogotá, CO',         flag: '🇨🇴', tone: 'amber', quote: 'Doy clases de inglés a estudiantes de toda la ciudad. La plataforma cambió mi vida.' },
  { name: 'Ravi Sharma',    role: 'Plumber',         city: 'Mumbai, IN',         flag: '🇮🇳', tone: 'cyan',  quote: 'Same-day jobs, real people, zero commission taken. Exactly what I needed.' },
  { name: 'Ana Beatriz',    role: 'Contratante',     city: 'Recife, BR',         flag: '🇧🇷', tone: 'amber', quote: 'Precisava de um pintor com urgência. Em 20 minutos já tinha 4 candidatos.' },
  { name: 'Marco Rossi',    role: 'Imbianchino',     city: 'Milano, IT',         flag: '🇮🇹', tone: 'cyan',  quote: 'Lavoro vicino a casa e scelgo i clienti. Semplice e gratuito.' },
  { name: 'Lena Müller',    role: 'Umzugshelferin',  city: 'Berlin, DE',         flag: '🇩🇪', tone: 'amber', quote: 'Ich beschreibe mein Können und bekomme Anfragen. Genial und kostenlos.' },
  { name: 'João Vitor',     role: 'Encanador',       city: 'Rio de Janeiro, BR', flag: '🇧🇷', tone: 'cyan',  quote: 'Saí do desemprego fazendo bikcos. Hoje tenho clientes fixos no bairro inteiro.' },
  { name: 'Camille Dubois', role: 'Femme de ménage', city: 'Paris, FR',          flag: '🇫🇷', tone: 'amber', quote: 'Je trouve du travail près de chez moi, sans intermédiaire. Un vrai bonheur.' },
  { name: 'Diego Fernández',role: 'Mudanzas',        city: 'Buenos Aires, AR',   flag: '🇦🇷', tone: 'cyan',  quote: 'Cargas y mudanzas todos los días. La gente me encuentra a mí, no al revés.' },
  { name: 'Patrícia Lima',  role: 'Doceira',         city: 'Araraquara, BR',     flag: '🇧🇷', tone: 'amber', quote: 'Vendo meus doces por encomenda pra cidade toda. Comecei sem gastar nada.' },
  { name: 'Kenji Tanaka',   role: 'Handyman',        city: 'Tóquio, JP',         flag: '🇯🇵', tone: 'cyan',  quote: 'Small repairs, big difference. People nearby reach me in minutes.' },
  { name: 'Fernanda Souza', role: 'Cuidadora',       city: 'Curitiba, BR',       flag: '🇧🇷', tone: 'amber', quote: 'Cuido de idosos e encontrei famílias maravilhosas pela Bikco. Gratidão!' },
  { name: 'Miguel Torres',  role: 'Jardinero',       city: 'Cidade do México, MX',flag: '🇲🇽', tone: 'cyan',  quote: 'Tengo trabajo toda la semana. Y lo mejor: es completamente gratis.' },
  { name: 'Beatriz Nunes',  role: 'Manicure',        city: 'Porto, PT',          flag: '🇵🇹', tone: 'amber', quote: 'Atendo em casa e a agenda lota. Os clientes me acham pela plataforma.' },
  { name: 'David Smith',    role: 'Mover',           city: 'Nova York, US',      flag: '🇺🇸', tone: 'cyan',  quote: 'I post that I am free and the gigs come to me. No platform fees at all.' },
  { name: 'Wei Chen',       role: '电工',             city: 'Xangai, CN',          flag: '🇨🇳', tone: 'amber', quote: '描述我的技能后，需求就来了。完全免费，太棒了。' },
  { name: 'Tiago Rocha',    role: 'Pedreiro',        city: 'Belo Horizonte, BR', flag: '🇧🇷', tone: 'cyan',  quote: 'Reformas pequenas e grandes. A Bikco me deu trabalho quando mais precisei.' },
  { name: 'Olusegun A.',    role: 'Tutor',           city: 'Nairóbi, KE',        flag: '🇰🇪', tone: 'amber', quote: 'Students across the city find me. Honest work, no middleman cut.' },
  { name: 'Valentina Ricci',role: 'Babysitter',      city: 'Roma, IT',           flag: '🇮🇹', tone: 'cyan',  quote: 'Trovo famiglie vicino a me e organizzo i miei orari. Tutto gratis.' },
  { name: 'Rafael Gomes',   role: 'Técnico de TI',   city: 'Lisboa, PT',         flag: '🇵🇹', tone: 'amber', quote: 'Conserto computadores e celulares. Os pedidos chegam sozinhos, sem pagar nada.' },
  { name: 'Yasmin Haddad',  role: 'Cozinheira',      city: 'Cairo, EG',          flag: '🇪🇬', tone: 'cyan',  quote: 'Faço marmitas por encomenda. A Bikco trouxe clientes que eu jamais alcançaria.' },
]

function initials(n: string) {
  return n.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function Card({ t, accent }: { t: Testi; accent: { amber: string; cyan: string; surface: string; border: string; text: string; text2: string } }) {
  const color = t.tone === 'amber' ? accent.amber : accent.cyan
  return (
    <div style={{
      width: 320, flexShrink: 0, background: accent.surface, border: `1px solid ${accent.border}`,
      borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
      marginRight: 16, whiteSpace: 'normal',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, border: `1px solid ${color}55`, color, fontSize: 14, fontWeight: 800 }}>
          {initials(t.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: accent.text, margin: 0 }}>{t.name}</p>
          <p style={{ fontSize: 12, color: accent.text2, margin: '1px 0 0' }}>{t.role} · {t.flag} {t.city}</p>
        </div>
      </div>
      <div style={{ color: accent.amber, fontSize: 13, letterSpacing: 1 }}>★★★★★</div>
      <p style={{ fontSize: 14, color: accent.text2, lineHeight: 1.55, margin: 0 }}>“{t.quote}”</p>
    </div>
  )
}

export default function Testimonials() {
  const { c, t } = useLanding()
  const half = Math.ceil(TESTIMONIALS.length / 2)
  const rowA = TESTIMONIALS.slice(0, half)
  const rowB = TESTIMONIALS.slice(half)

  return (
    <section style={{ borderTop: `1px solid ${c.border}`, padding: '72px 0', background: c.bg, overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', padding: '0 20px', marginBottom: 40 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.cyan, marginBottom: 12 }}>{t('testi_kicker')}</p>
        <h2 style={{ fontSize: 'clamp(22px, 3.6vw, 34px)', fontWeight: 800, color: c.text, letterSpacing: '-0.6px', margin: 0 }}>{t('testi_title')}</h2>
      </div>

      {/* Marquee duas faixas, direções opostas */}
      <div className="mq-wrap">
        <div className="mq mq-left">
          {[...rowA, ...rowA].map((tm, i) => <Card key={`a${i}`} t={tm} accent={c} />)}
        </div>
        <div className="mq mq-right" style={{ marginTop: 16 }}>
          {[...rowB, ...rowB].map((tm, i) => <Card key={`b${i}`} t={tm} accent={c} />)}
        </div>
      </div>

      <style>{`
        .mq-wrap { display:flex; flex-direction:column; }
        .mq { display:flex; width:max-content; }
        .mq-left  { animation: mq-scroll-l 60s linear infinite; }
        .mq-right { animation: mq-scroll-r 70s linear infinite; }
        .mq-wrap:hover .mq { animation-play-state: paused; }
        @keyframes mq-scroll-l { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes mq-scroll-r { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) {
          .mq-left, .mq-right { animation: none; }
          .mq-wrap { overflow-x: auto; }
        }
      `}</style>
    </section>
  )
}
