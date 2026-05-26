'use client'

import { useEffect, useRef } from 'react'

const DEG = Math.PI / 180

interface Dot { lat: number; lng: number; sz: number; a: number; city?: boolean }

/* ── 1 200 pontos de serviço + 15 cidades ── */
function buildDots(): Dot[] {
  let s = 0x9e3779b9 >>> 0
  const rnd = () => { s ^= s<<13; s ^= s>>>17; s ^= s<<5; return (s>>>0)/0xffffffff }
  const zones: [number,number,number,number,number][] = [
    [ 10, 55,  60, 148, 30],
    [ 30, 72, -12,  45, 22],
    [ 25, 50,-127, -65, 15],
    [ -8, 37, -18,  52, 18],
    [-56, 12, -82, -34, 10],
    [-45,-10, 110, 155,  4],
    [ 55, 72,  30, 180,  1],
  ]
  const total = zones.reduce((a,z)=>a+z[4],0)
  const dots: Dot[] = []

  for (let i=0;i<1200;i++) {
    let r=rnd()*total; let z=zones[0]
    for (const zone of zones){r-=zone[4];if(r<=0){z=zone;break}}
    dots.push({ lat:z[0]+rnd()*(z[1]-z[0]), lng:z[2]+rnd()*(z[3]-z[2]), sz:1+rnd()*1.4, a:0.15+rnd()*0.45 })
  }

  const cities: [number,number][] = [
    [-23.55,-46.63],[40.71,-74.01],[51.51,-0.13],[35.68,139.65],[19.08,72.88],
    [48.86,2.35],[31.23,121.47],[-34.60,-58.38],[6.52,3.38],[34.05,-118.24],
    [25.20,55.27],[1.35,103.82],[-33.87,151.21],[55.76,37.62],[28.61,77.21],
  ]
  for (const [lat,lng] of cities)
    dots.push({ lat, lng, sz:3.5, a:1, city:true })

  return dots
}

const DOTS = buildDots()

export default function GlobeCanvas() {
  const ref  = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rot      = 20
    let raf      = 0
    let alive    = true
    let dragging = false
    let lastX    = 0
    let spinning = true

    /* resize */
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const size = Math.min(parent.clientWidth, parent.clientHeight, 600)
      const dpr  = window.devicePixelRatio || 1
      canvas.width  = size * dpr
      canvas.height = size * dpr
      canvas.style.width  = size + 'px'
      canvas.style.height = size + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    /* drag */
    const onDown  = (x: number) => { dragging=true; lastX=x; spinning=false }
    const onMove  = (x: number) => { if (!dragging) return; rot+=(x-lastX)*0.35; lastX=x }
    const onUp    = () => { dragging=false; setTimeout(()=>spinning=true, 2500) }

    canvas.addEventListener('mousedown',  e => onDown(e.clientX))
    canvas.addEventListener('mousemove',  e => onMove(e.clientX))
    canvas.addEventListener('mouseup',    onUp)
    canvas.addEventListener('mouseleave', onUp)
    canvas.addEventListener('touchstart', e => onDown(e.touches[0].clientX), {passive:true})
    canvas.addEventListener('touchmove',  e => { onMove(e.touches[0].clientX); e.preventDefault() }, {passive:false})
    canvas.addEventListener('touchend',   onUp)

    /* draw */
    const draw = () => {
      if (!alive) return
      if (spinning && !dragging) rot += 0.1

      const dpr = window.devicePixelRatio || 1
      const W=canvas.width, H=canvas.height
      const cx=W/2, cy=H/2, R=W*0.43

      ctx.clearRect(0,0,W,H)

      /* atmosphere */
      const atmo = ctx.createRadialGradient(cx,cy,R*.88,cx,cy,R*1.14)
      atmo.addColorStop(0,'rgba(25,80,200,0.22)')
      atmo.addColorStop(1,'rgba(25,80,200,0)')
      ctx.beginPath(); ctx.arc(cx,cy,R*1.14,0,Math.PI*2)
      ctx.fillStyle=atmo; ctx.fill()

      /* sphere */
      const bg = ctx.createRadialGradient(cx-R*.22,cy-R*.22,R*.08,cx,cy,R)
      bg.addColorStop(0,'#0e2040')
      bg.addColorStop(.65,'#071020')
      bg.addColorStop(1,'#020810')
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2)
      ctx.fillStyle=bg; ctx.fill()

      /* clip */
      ctx.save()
      ctx.beginPath(); ctx.arc(cx,cy,R-.5,0,Math.PI*2); ctx.clip()

      /* grid — latitude lines */
      ctx.lineWidth = .5*dpr
      for (let lat=-60;lat<=60;lat+=30) {
        const y  = cy - Math.sin(lat*DEG)*R
        const hw = Math.cos(lat*DEG)*R
        ctx.beginPath()
        ctx.moveTo(cx-hw,y); ctx.lineTo(cx+hw,y)
        ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.stroke()
      }

      /* grid — longitude arcs */
      for (let lng=0;lng<360;lng+=30) {
        const λ=(lng+rot)*DEG
        const zRef=Math.cos(λ)
        if (zRef<-0.1) continue
        ctx.beginPath()
        let first=true
        for (let lat=-90;lat<=90;lat+=4) {
          const φ=lat*DEG
          const z3=Math.cos(φ)*Math.cos(λ)
          const x=cx+Math.cos(φ)*Math.sin(λ)*R
          const y=cy-Math.sin(φ)*R
          if (first){ctx.moveTo(x,y);first=false}
          else if(z3>-0.05)ctx.lineTo(x,y)
          else ctx.moveTo(x,y)
        }
        ctx.strokeStyle=`rgba(255,255,255,${Math.max(0,(zRef)*.04)})`
        ctx.stroke()
      }

      /* dots */
      for (const d of DOTS) {
        const φ=d.lat*DEG, λ=(d.lng+rot)*DEG
        const x3=Math.cos(φ)*Math.sin(λ)
        const y3=-Math.sin(φ)
        const z3=Math.cos(φ)*Math.cos(λ)
        if (z3<=0) continue

        const sx=cx+x3*R, sy=cy+y3*R
        const bright=Math.pow(z3,.35)
        const r=d.sz*dpr*(0.4+bright*.6)

        ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2)
        if (d.city) {
          ctx.fillStyle=`rgba(255,209,26,${bright*.95})`
          ctx.fill()
          /* halo */
          const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r*4)
          g.addColorStop(0,`rgba(255,209,26,${bright*.18})`)
          g.addColorStop(1,'rgba(255,209,26,0)')
          ctx.beginPath(); ctx.arc(sx,sy,r*4,0,Math.PI*2)
          ctx.fillStyle=g; ctx.fill()
        } else {
          ctx.fillStyle=`rgba(255,209,26,${d.a*bright})`
          ctx.fill()
        }
      }

      ctx.restore()

      /* edge rim */
      const rim=ctx.createRadialGradient(cx,cy,R*.75,cx,cy,R)
      rim.addColorStop(0,'rgba(30,90,200,0)')
      rim.addColorStop(1,'rgba(30,90,200,0.18)')
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2)
      ctx.fillStyle=rim; ctx.fill()

      raf=requestAnimationFrame(draw)
    }

    draw()
    return () => {
      alive=false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize',resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ display:'block', cursor:'grab', userSelect:'none' }}
    />
  )
}
