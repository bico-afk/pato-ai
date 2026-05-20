'use client'

import dynamic from 'next/dynamic'

const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100dvh',
      background: '#0F0F0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
        <div style={{ color: '#FFD11A', fontSize: 15, fontWeight: 600 }}>Carregando mapa...</div>
      </div>
    </div>
  ),
})

export default function MapPage() {
  return <MapClient />
}
