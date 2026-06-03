'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanding } from './LandingProvider'
import BikcoDuck from './BikcoDuck'

/* Chat flutuante no canto: convida o visitante a oferecer um serviço.
   Ao enviar, leva ao chat real de cadastro (/prestador). */
export default function BikcoChat() {
  const { c, t } = useLanding()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  function go() {
    const q = text.trim()
    router.push(q ? `/prestador?skill=${encodeURIComponent(q)}` : '/prestador')
  }

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 900, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {open && (
        <div style={{ width: 'min(340px, calc(100vw - 36px))', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden', marginBottom: 12, animation: 'bchat-in 0.25s ease-out both' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: `linear-gradient(135deg, ${c.amber}22, ${c.cyan}18)`, borderBottom: `1px solid ${c.border}` }}>
            <BikcoDuck size={26} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: c.text, margin: 0 }}>{t('chat_title')}</p>
              <p style={{ fontSize: 11, color: c.cyan, margin: '1px 0 0', fontWeight: 600 }}>● online</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text2, fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px' }}>
            <div style={{ background: c.bgSoft, border: `1px solid ${c.border}`, borderRadius: '4px 16px 16px 16px', padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 13.5, color: c.text, lineHeight: 1.55, margin: 0 }}>{t('chat_greeting')}</p>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
              rows={2}
              placeholder={t('chat_placeholder')}
              style={{ width: '100%', resize: 'none', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, color: c.text, fontSize: 13.5, padding: '10px 12px', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
            />

            <button onClick={go}
              style={{ width: '100%', marginTop: 10, height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, background: c.amber, color: c.ink, boxShadow: `0 0 22px ${c.amber}33` }}>
              {t('chat_send')} →
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button onClick={() => setOpen(o => !o)} className="bchat-fab"
        style={{ display: 'flex', alignItems: 'center', gap: 9, height: 54, padding: '0 20px 0 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: c.amber, color: c.ink, fontSize: 14.5, fontWeight: 800, boxShadow: `0 8px 30px ${c.amber}55`, marginLeft: 'auto' }}>
        <BikcoDuck size={26} color={c.ink} />
        {open ? '—' : t('chat_open')}
      </button>

      <style>{`
        @keyframes bchat-in { from { opacity:0; transform: translateY(12px) scale(0.97);} to { opacity:1; transform:none; } }
        .bchat-fab { animation: bchat-bob 3.2s ease-in-out infinite; }
        @keyframes bchat-bob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-3px);} }
        @media (prefers-reduced-motion: reduce) { .bchat-fab { animation: none; } }
      `}</style>
    </div>
  )
}
