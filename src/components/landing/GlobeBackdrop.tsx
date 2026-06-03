/* Globo decorativo (SVG) de fundo — meridianos e paralelos.
   Leve, sem WebGL. Usado atrás da seção "Pedidos chegando agora". */
export default function GlobeBackdrop({ color = '#2DD4BF', opacity = 0.12, size = 520 }: { color?: string; opacity?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden
      style={{ opacity }}>
      <circle cx="100" cy="100" r="92" stroke={color} strokeWidth="0.6" />
      {/* paralelos */}
      {[ -60, -30, 0, 30, 60 ].map((lat, i) => {
        const ry = 92 * Math.cos((lat * Math.PI) / 180)
        const cy = 100 + 92 * Math.sin((lat * Math.PI) / 180)
        return <ellipse key={`p${i}`} cx="100" cy={cy} rx="92" ry={Math.max(ry * 0.18, 2)} stroke={color} strokeWidth="0.5" opacity={0.7} />
      })}
      {/* meridianos */}
      {[ 0, 26, 52, 78 ].map((rot, i) => (
        <ellipse key={`m${i}`} cx="100" cy="100" rx={92 * Math.cos((rot * Math.PI) / 180)} ry="92" stroke={color} strokeWidth="0.5" opacity={0.7} transform={`rotate(${0} 100 100)`} />
      ))}
      <ellipse cx="100" cy="100" rx="92" ry="92" stroke="none" />
    </svg>
  )
}
