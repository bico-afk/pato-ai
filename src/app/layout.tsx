import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PageBadge from '@/components/PageBadge'
import DebugOverlay from '@/components/DebugOverlay'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pato AI',
  description: 'Rede social de serviços',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body>
        <PageBadge />
        <DebugOverlay />
        {children}
      </body>
    </html>
  )
}
