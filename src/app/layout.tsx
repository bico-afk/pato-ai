import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import PWARegister from '@/components/PWARegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bikco — Toda necessidade tem alguém do outro lado',
  description: 'A rede de serviços humanos. Publique o que você precisa, ou ganhe uma renda extra fazendo um bikco. De graça.',
  keywords: 'profissional, serviços, bico, pedreiro, eletricista, encanador, faxina, diarista, freelancer, renda extra, Brasil',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Bikco' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'Bikco — Toda necessidade tem alguém do outro lado',
    description: 'A rede de serviços humanos. Publique o que você precisa, ou ganhe uma renda extra fazendo um bikco.',
    siteName: 'Bikco',
    locale: 'pt_BR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#000' }}>
        <PWARegister />
        <Navbar />
        {children}
      </body>
    </html>
  )
}
