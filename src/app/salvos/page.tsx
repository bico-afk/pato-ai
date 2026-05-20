'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'

function IconArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
}

export default function SalvosPage() {
  const router = useRouter()
  return (
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #181818' }}>
        <button onClick={() => router.push('/feed')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <IconArrow /> voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Image src="/pato-icon.svg" alt="pato" width={22} height={22} />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>pato<span style={{ color: '#FFD11A' }}>.ai</span></span>
        </div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔖</div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Salvos em breve</p>
        <p style={{ fontSize: 14, color: '#555', margin: 0, lineHeight: 1.5 }}>Aqui você vai ver os bicos que salvou para depois.</p>
      </div>
    </div>
  )
}
