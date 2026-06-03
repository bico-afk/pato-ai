import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre a Bikco — Toda necessidade tem alguém do outro lado',
  description: 'A Bikco aproxima quem precisa de quem sabe fazer. Uma rede de serviços humanos, livre e do tamanho do mundo. Publicar e oferecer é grátis.',
}

const AMBER = '#FFC53D'
const CYAN = '#2DD4BF'

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.6px', margin: '0 0 16px' }}>{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 16.5, lineHeight: 1.75, color: '#b9b9c2', margin: '0 0 18px' }}>{children}</p>
}

export default function SobrePage() {
  return (
    <main style={{ background: '#0A0A0B', minHeight: '100dvh', color: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '64px 22px 96px' }}>

        <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: CYAN, margin: '0 0 14px' }}>Bikco</p>
        <h1 style={{ fontSize: 'clamp(30px, 5.4vw, 48px)', fontWeight: 900, letterSpacing: '-1.2px', lineHeight: 1.12, margin: '0 0 36px', color: '#fff' }}>
          Toda necessidade tem alguém do outro lado.
        </h1>

        <P>
          Pense na última vez que você precisou resolver alguma coisa em casa. Um chuveiro que parou de
          esquentar numa noite de sexta. Uma faxina antes da visita de domingo. Um móvel encalhado na caixa
          esperando montagem há semanas. Um frete que você adiou porque não sabia a quem ligar.
        </P>
        <P>
          Agora pense em quantas pessoas, na sua cidade, neste exato momento, sabem fazer exatamente isso —
          e estão com tempo livre, procurando uma renda extra.
        </P>
        <P><strong style={{ color: '#fff' }}>A Bikco existe para aproximar esses dois. E só isso já muda tudo.</strong></P>

        <Divider />
        <H>Como sempre deveria ter sido</H>
        <P>
          A maioria das plataformas faz você caçar. Listas, categorias, filtros, dezenas de perfis para
          comparar, mensagens que ninguém responde. Você vira o caçador de um profissional que talvez nem
          esteja disponível.
        </P>
        <P><strong style={{ color: AMBER }}>A Bikco inverte o jogo.</strong></P>
        <P>
          Você descreve, com suas próprias palavras, o que precisa: <em>“preciso de uma diarista para faxina
          completa no sábado”</em>, <em>“consertar o chuveiro hoje à noite”</em>, <em>“um pedreiro para um
          muro pequeno”</em>. Publica. E são os profissionais da sua região que encontram você. Sem caça, sem
          leilão, sem complicação.
        </P>

        <Divider />
        <H>Dois lados. Uma rede. Infinitas possibilidades.</H>
        <P>
          <strong style={{ color: '#fff' }}>Precisa resolver algo?</strong> Publique de graça e deixe a pessoa
          certa chegar até você. Faxina, reparos, frete, montagem, aulas, um ajudante para o dia — se alguém
          sabe fazer, alguém vai responder.
        </P>
        <P>
          <strong style={{ color: '#fff' }}>Quer ganhar uma renda extra?</strong> Faça um bikco. Tem uma
          habilidade, uma ferramenta, um tempo livre no fim de semana? Encontre trabalho perto de você, no seu
          ritmo, do seu jeito. Sem mensalidade, sem patrão, sem pedágio cobrado no meio do caminho.
        </P>
        <P>
          Porque a verdade é simples: <strong style={{ color: '#fff' }}>todo mundo precisa de alguém, e todo
          mundo sabe fazer alguma coisa.</strong>
        </P>

        <Divider />
        <H>Uma rede viva — e ela é do tamanho do mundo</H>
        <P>
          Abra a Bikco e veja, acontecendo agora, gente resolvendo e gente ganhando. Um pedido de pintura
          aqui. Alguém pegando um frete ali. Uma diarista fechando o sábado. Um conserto sendo combinado a três
          quarteirões de você.
        </P>
        <P>
          A Bikco é uma rede aberta, livre e construída para crescer sem fronteiras. É das pessoas que a usam —
          e existe para servir a elas. Esse é o futuro do trabalho que estamos construindo: uma vitrine viva da
          capacidade humana, onde a habilidade de qualquer pessoa encontra quem precisa dela.
        </P>

        <Divider />
        <H>Confiança no coração de tudo</H>
        <P>
          Aproximar pessoas é uma responsabilidade séria — e a gente trata como séria. Cada bikco constrói
          reputação. Cada perfil tem uma pessoa real por trás. Você chega para resolver um problema, não para
          ganhar outro.
        </P>
        <P>
          Numa era de inteligência artificial, priorizamos o trabalho humano: cada ser humano tem alguma
          habilidade — e merece a chance de viver dela.
        </P>

        <Divider />
        <H>Comece agora</H>
        <P>
          Tem uma necessidade? <strong style={{ color: '#fff' }}>Publique seu pedido — é grátis.</strong><br />
          Tem uma habilidade? <strong style={{ color: '#fff' }}>Faça seu primeiro bikco.</strong>
        </P>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/" style={{ height: 50, display: 'inline-flex', alignItems: 'center', padding: '0 24px', borderRadius: 12, background: AMBER, color: '#1a1300', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
            Publicar um pedido
          </Link>
          <Link href="/prestador" style={{ height: 50, display: 'inline-flex', alignItems: 'center', padding: '0 24px', borderRadius: 12, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
            Fazer um bikco
          </Link>
        </div>

        <p style={{ fontSize: 15, color: '#6b6b73', margin: '40px 0 0', fontWeight: 600 }}>
          Bikco. Toda necessidade tem alguém do outro lado.
        </p>
      </article>
    </main>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '40px 0' }} />
}
