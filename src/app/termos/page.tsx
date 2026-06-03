import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Termos de Uso — Bikco' }

export default function TermosPage() {
  return (
    <main style={{ background: '#0A0A0B', minHeight: '100dvh', color: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '56px 22px 96px', lineHeight: 1.7 }}>
        <Link href="/" style={{ fontSize: 13, color: '#8A8A93', textDecoration: 'none' }}>← Início</Link>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.8px', margin: '20px 0 8px' }}>Termos de Uso</h1>
        <p style={{ color: '#6b6b73', fontSize: 13, marginBottom: 32 }}>Última atualização: junho de 2026</p>

        {[
          ['1. O que é a Bikco', 'A Bikco é uma plataforma que aproxima pessoas que precisam de um serviço de pessoas que sabem realizá-lo ("bikcos"). Quem precisa publica um pedido; profissionais da região entram em contato. A Bikco não executa os serviços nem é parte dos acordos firmados entre os usuários.'],
          ['2. Uso gratuito', 'Publicar pedidos e oferecer serviços é gratuito. A Bikco não cobra comissão sobre os trabalhos combinados entre as partes.'],
          ['3. Responsabilidade dos usuários', 'Cada usuário é responsável pelas informações que publica e pelos serviços que presta ou contrata. Combine condições, valores e prazos diretamente com a outra parte. A Bikco não garante a execução, a qualidade ou o pagamento de nenhum serviço.'],
          ['4. Conduta', 'É proibido publicar conteúdo ilegal, ofensivo, enganoso ou que viole direitos de terceiros. Contas que descumprirem estas regras podem ser suspensas.'],
          ['5. Verificação e reputação', 'A Bikco pode solicitar dados de verificação (como CPF) para aumentar a segurança da rede. A reputação é construída a partir das interações reais entre usuários.'],
          ['6. Limitação de responsabilidade', 'A Bikco fornece a plataforma "como está". Não nos responsabilizamos por danos decorrentes de acordos entre usuários, indisponibilidades temporárias ou conteúdo publicado por terceiros.'],
          ['7. Alterações', 'Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas na plataforma.'],
          ['8. Contato', 'Dúvidas? Fale com a gente pelo WhatsApp ou pelos canais oficiais da Bikco.'],
        ].map(([h, p], i) => (
          <section key={i} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{h}</h2>
            <p style={{ fontSize: 15.5, color: '#b9b9c2', margin: 0 }}>{p}</p>
          </section>
        ))}
      </article>
    </main>
  )
}
