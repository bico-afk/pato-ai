import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bikco — Encontre qualquer profissional em segundos',
  description: 'Publique o que você precisa. Um profissional vai fazer. Pedreiro, eletricista, encanador, faxina e muito mais.',
  keywords: 'profissional, serviços, bico, pedreiro, eletricista, encanador, faxina, diarista, freelancer, Brasil',
  openGraph: {
    title: 'Bikco — Encontre qualquer profissional em segundos',
    description: 'Publique o que você precisa. Um profissional vai fazer.',
    siteName: 'Bikco',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0F0F0F' }}>
        {children}
      </body>
    </html>
  )
}
