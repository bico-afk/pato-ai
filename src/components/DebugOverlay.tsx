'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Armazena logs globalmente ────────────────────────────────
const logs: { ts: string; type: 'error' | 'warn' | 'info'; msg: string }[] = []

export function dbg(type: 'error' | 'warn' | 'info', msg: string) {
  const ts = new Date().toLocaleTimeString('pt-BR')
  logs.unshift({ ts, type, msg: typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg) })
  if (logs.length > 30) logs.pop()
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pato-debug'))
}

// ── Hook para usar em qualquer página ────────────────────────
export function useDbg() { return dbg }

// ── Componente visual ─────────────────────────────────────────
export default function DebugOverlay() {
  const [open,  setOpen]  = useState(false)
  const [items, setItems] = useState<typeof logs>([])

  const refresh = useCallback(() => setItems([...logs]), [])

  useEffect(() => {
    window.addEventListener('pato-debug', refresh)
    return () => window.removeEventListener('pato-debug', refresh)
  }, [refresh])

  const hasError = items.some(i => i.type === 'error')

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => { setOpen(o => !o); refresh() }}
        style={{
          position: 'fixed', bottom: 12, right: 12, zIndex: 999999,
          width: 38, height: 38, borderRadius: '50%',
          backgroundColor: hasError ? '#FF4D6A' : '#222',
          border: `2px solid ${hasError ? '#FF4D6A' : '#444'}`,
          color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hasError ? '0 0 10px #FF4D6A88' : 'none',
        }}
        title="Debug Pato AI"
      >
        {hasError ? '🔴' : '🟢'}
      </button>

      {/* Painel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 58, right: 12, zIndex: 999998,
          width: 340, maxHeight: '60vh', overflowY: 'auto',
          backgroundColor: '#0a0a0a', border: '1px solid #333',
          borderRadius: 12, fontFamily: 'monospace', fontSize: 11,
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FFD11A', fontWeight: 700, fontSize: 12 }}>🦆 Pato Debug</span>
            <button onClick={() => { logs.length = 0; refresh() }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>limpar</button>
          </div>
          {items.length === 0 && (
            <p style={{ color: '#444', padding: '12px', margin: 0 }}>Nenhum log ainda.</p>
          )}
          {items.map((l, i) => (
            <div key={i} style={{
              padding: '6px 10px',
              borderBottom: '1px solid #151515',
              backgroundColor: l.type === 'error' ? '#1a0505' : l.type === 'warn' ? '#1a1200' : 'transparent',
            }}>
              <div style={{ color: '#444', fontSize: 10, marginBottom: 2 }}>{l.ts}</div>
              <div style={{ color: l.type === 'error' ? '#FF7A7A' : l.type === 'warn' ? '#FFD11A' : '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {l.type === 'error' ? '❌ ' : l.type === 'warn' ? '⚠️ ' : 'ℹ️ '}{l.msg}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
