import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacidade — Bikco' }

export default function PrivacidadePage() {
  return (
    <main style={{ background: '#0A0A0B', minHeight: '100dvh', color: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '56px 22px 96px', lineHeight: 1.7 }}>
        <Link href="/" style={{ fontSize: 13, color: '#8A8A93', textDecoration: 'none' }}>← Início</Link>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.8px', margin: '20px 0 8px' }}>Política de Privacidade</h1>
        <p style={{ color: '#6b6b73', fontSize: 13, marginBottom: 32 }}>Última atualização: junho de 2026</p>

        {[
          ['Que dados coletamos', 'Dados de cadastro (nome, e-mail, telefone/WhatsApp), o conteúdo dos pedidos e candidaturas que você publica, e dados de verificação opcionais (como CPF) usados apenas para confirmar identidade.'],
          ['Endereço é anônimo', 'Seu endereço completo NÃO é exibido publicamente. Mostramos apenas a sua cidade. As coordenadas exatas são usadas somente para aproximar você de profissionais próximos.'],
          ['CPF e documentos', 'Dados de verificação como CPF ficam armazenados de forma restrita e NÃO aparecem para outros usuários — nem para quem recebe sua candidatura. Servem apenas para segurança e verificação de identidade.'],
          ['Como usamos seus dados', 'Para conectar você à pessoa certa, exibir seu pedido/perfil aos usuários relevantes, e manter a segurança da rede. Não vendemos seus dados.'],
          ['Com quem compartilhamos', 'Apenas o necessário para o serviço funcionar (ex.: nome e contato ficam visíveis para a outra parte quando vocês decidem conversar). Nunca expomos e-mail, telefone ou CPF de forma pública.'],
          ['Seus direitos', 'Você pode acessar, corrigir ou excluir seus dados a qualquer momento pelo seu perfil ou solicitando à nossa equipe.'],
          ['Contato', 'Para qualquer questão sobre privacidade, fale com a gente pelos canais oficiais da Bikco.'],
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
