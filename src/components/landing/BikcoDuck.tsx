'use client'

import { C } from '@/lib/landingTokens'

/* ───────────────────────────────────────────────────────────────
   <BikcoDuck /> — mascote em forma de pato (PLACEHOLDER).
   Silhueta em traço único. Micro-animação: pisca/acena no hover.
   // TODO: substituir pelo asset final do pato quando estiver pronto.
   ─────────────────────────────────────────────────────────────── */
export default function BikcoDuck({ size = 28, color = C.amber }: { size?: number; color?: string }) {
  return (
    <span className="bikco-duck" style={{ display: 'inline-flex', lineHeight: 0 }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
        stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {/* corpo + cabeça (traço único) */}
        <path className="bikco-duck-body" d="M14 34c-4 0-7-3-7-7 0-5 4-9 10-9 1-6 6-10 12-10 7 0 12 5 12 12 0 8-7 14-16 14H14z" />
        {/* bico */}
        <path className="bikco-duck-bill" d="M37 17l6 1-5 3" fill={color} stroke={color} />
        {/* olho que pisca */}
        <circle className="bikco-duck-eye" cx="31" cy="16" r="1.6" fill={color} stroke="none" />
        {/* asa que acena */}
        <path className="bikco-duck-wing" d="M22 27c3 0 6 1 8 3" />
      </svg>

      <style>{`
        .bikco-duck-eye  { transform-box: fill-box; transform-origin: center; }
        .bikco-duck-wing { transform-box: fill-box; transform-origin: 22px 27px; }
        /* anima ao passar o mouse no logo (grupo pai .bikco-logo) ou no próprio pato */
        .bikco-logo:hover .bikco-duck-eye,
        .bikco-duck:hover .bikco-duck-eye   { animation: duck-blink 0.9s ease-in-out 1; }
        .bikco-logo:hover .bikco-duck-wing,
        .bikco-duck:hover .bikco-duck-wing  { animation: duck-wave 0.7s ease-in-out 1; }
        @keyframes duck-blink { 0%,100% { transform: scaleY(1); } 45%,55% { transform: scaleY(0.1); } }
        @keyframes duck-wave  { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-18deg); } }
        @media (prefers-reduced-motion: reduce) {
          .bikco-duck-eye, .bikco-duck-wing { animation: none !important; }
        }
      `}</style>
    </span>
  )
}
