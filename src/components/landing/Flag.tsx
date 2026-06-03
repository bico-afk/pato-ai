/* Bandeira por imagem (flagcdn) — emoji de bandeira não renderiza no Windows.
   cc = código ISO do país em minúsculo (ex.: 'br', 'us', 'cn'). */
export default function Flag({ cc, size = 20 }: { cc: string; size?: number }) {
  const h = Math.round(size * 0.7)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      width={size}
      height={h}
      alt=""
      loading="lazy"
      style={{ display: 'inline-block', borderRadius: 3, objectFit: 'cover', verticalAlign: 'middle', boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}
    />
  )
}
