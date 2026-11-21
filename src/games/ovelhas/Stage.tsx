import { useEffect, useRef } from 'react'
import { sheepPose, type SheepPass } from './engine'

export type StageMood = 'idle' | 'ready' | 'count' | 'guess' | 'result'
const W = 800, H = 372
const wool = ['#fffbec', '#fae3ff', '#fff1b9', '#e4dbff']

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill()
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, stroke?: string) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = color; c.fill()
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2.5; c.stroke() }
}
function curve(c: CanvasRenderingContext2D, color: string, width: number, path: () => void) {
  c.beginPath(); path(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke()
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color
  c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * .17, y - r * .17, x + r, y)
  c.quadraticCurveTo(x + r * .17, y + r * .17, x, y + r)
  c.quadraticCurveTo(x - r * .17, y + r * .17, x - r, y)
  c.quadraticCurveTo(x - r * .17, y - r * .17, x, y - r); c.fill()
}

function landscape(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#51327c'); sky.addColorStop(.67, '#a781ce'); sky.addColorStop(1, '#e1bdf4')
  c.fillStyle = sky; c.fillRect(0, 0, W, H)
  const halo = c.createRadialGradient(637, 72, 22, 637, 72, 116)
  halo.addColorStop(0, '#ffe8a855'); halo.addColorStop(1, '#ffe8a800')
  c.fillStyle = halo; c.fillRect(518, 0, 245, 190)
  oval(c, 637, 72, 43, 43, '#f9e9ac')
  oval(c, 624, 79, 5, 5, '#e7cb86'); oval(c, 651, 54, 9, 7, '#eed793')
  oval(c, 659, 84, 5, 4, '#e7cb86')
  for (let i = 0; i < 29; i++) {
    const x = 16 + i * 53 % 768, y = 15 + i * 37 % 126
    if (Math.hypot(x - 637, y - 72) < 54) continue
    if (i % 5 === 0) star(c, x, y, 6 + i % 3, '#fff3bd')
    else oval(c, x, y, 1.5 + i % 2, 1.5 + i % 2, '#ebcef5aa')
  }
  const hill = (start: number, color: string, a: number, b: number) => {
    c.beginPath(); c.moveTo(0, start); c.bezierCurveTo(128, a, 247, b, 422, start + 7)
    c.bezierCurveTo(558, a + 23, 670, b - 5, W, start + 12)
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fillStyle = color; c.fill()
  }
  hill(186, '#7752a5', 101, 237); hill(230, '#8d65b8', 133, 269); hill(288, '#aa82ce', 206, 330)
  hill(325, '#bc97db', 249, 357)
  for (let i = 0; i < 34; i++) oval(c, 17 + i * 83 % 766, 278 + i * 27 % 88, 2 + i % 3, 1.6, '#7352a24a')
  // The fence is behind all three crossing lanes.
  for (let i = 0; i < 12; i++) {
    const x = i * 72 - 8
    box(c, x, 241, 72, 8, 4, '#6e4a9a')
    box(c, x, 257, 72, 7, 3, '#7952a5')
    box(c, x + 13, 228, 8, 47, 4, '#694492')
  }
}

function sleeper(c: CanvasRenderingContext2D, time: number, awake: boolean) {
  const x = 35, y = 320
  oval(c, x + 97, y + 29, 110, 13, '#58368335')
  box(c, x + 4, y - 40, 16, 67, 7, '#583680')
  box(c, x + 172, y - 17, 13, 44, 6, '#583680')
  box(c, x + 13, y - 18, 163, 35, 10, '#f3d7ff', '#583680')
  box(c, x + 21, y - 28, 57, 28, 12, '#fff0d2', '#583680')
  const breath = awake ? 0 : Math.sin(time / 420) * 2
  oval(c, x + 51, y - 30 - breath, 24, 23, '#583680')
  oval(c, x + 55, y - 27 - breath, 19, 17, '#f3b78f')
  oval(c, x + 67, y - 22 - breath, 5, 3, '#e7968c')
  if (awake) oval(c, x + 63, y - 28, 2.8, 3.2, '#4a296e')
  else curve(c, '#4a296e', 2.2, () => { c.moveTo(x + 57, y - 27 - breath); c.quadraticCurveTo(x + 62, y - 22 - breath, x + 67, y - 27 - breath) })
  box(c, x + 73, y - 24 - breath, 96, 34 + breath, 10, '#9270ce', '#583680')
  box(c, x + 78, y - 21 - breath, 83, 7, 4, '#bb9ae5')
  for (let i = 0; i < 4; i++) star(c, x + 91 + i * 19, y - 3, 5, '#f8e5ac')
  if (!awake) {
    c.fillStyle = '#fff0c7'; c.font = 'bold 16px Fredoka, sans-serif'
    c.fillText('z', x + 32, y - 62 - breath)
    c.font = 'bold 23px Fredoka, sans-serif'
    c.fillText('z', x + 47, y - 74 - breath)
  } else star(c, x + 49, y - 65, 12, '#ffecac')
}

function drawSheep(c: CanvasRenderingContext2D, pass: SheepPass, progress: number) {
  const { run, facing, hopProgress, still, drop, impact } = sheepPose(pass, progress)
  const x = -61 + (W + 122) * run
  const ground = 217 + pass.lane * 28
  const hop = Math.abs(Math.sin(hopProgress * Math.PI * pass.hops))
  const impactBounce = Math.sin(impact * Math.PI) * 12
  const y = ground - hop * pass.bounce - drop - impactBounce
  if (impact > 0) drawImpact(c, x, ground + 16, impact)
  oval(c, x, ground + 17, (26 - hop * 9) * pass.size, 4, '#41235f35')
  c.save(); c.translate(x, y); c.scale(pass.size * facing, pass.size)
  if (!still) c.rotate(Math.sin(hopProgress * Math.PI * pass.hops * 2) * .15)
  const feet = still ? 0 : Math.sin(hopProgress * Math.PI * pass.hops * 4) * 8
  curve(c, '#4f315f', 5, () => {
    c.moveTo(-15, 9); c.lineTo(-19 + feet, 22)
    c.moveTo(-4, 10); c.lineTo(-6 - feet, 22)
    c.moveTo(11, 10); c.lineTo(9 + feet, 22)
    c.moveTo(21, 8); c.lineTo(24 - feet, 21)
  })
  oval(c, -25, -4, 12, 8, '#c3a8dc')
  const color = wool[pass.fleece]
  oval(c, -4, 0, 28, 15, color)
  oval(c, -20, -6, 14, 14, color); oval(c, -7, -13, 16, 15, color)
  oval(c, 9, -11, 15, 15, color); oval(c, 17, 1, 13, 13, color)
  oval(c, 25, -14, 11, 6, '#6f4a82'); oval(c, 26, -4, 15, 12, '#674779')
  oval(c, 24, -15, 9, 6, color)
  oval(c, 30, -7, 2.5, 2.8, '#fff9e9'); oval(c, 31, -7, 1.25, 1.8, '#38224d')
  oval(c, 36, -1, 3.2, 2.1, '#eba5b8')
  if (pass.hops === 2 && !still) star(c, -40, -10, 6, '#fbe3a3')
  c.restore()
}

function drawImpact(c: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const fade = 1 - progress
  c.save()
  c.strokeStyle = `rgba(255, 239, 190, ${fade * .8})`; c.lineWidth = 3
  c.beginPath(); c.ellipse(x, y, 8 + progress * 28, 3 + progress * 7, 0, 0, Math.PI * 2); c.stroke()
  c.fillStyle = `rgba(255, 248, 222, ${fade * .82})`
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1
    const distance = 10 + progress * (15 + i * 2)
    const rise = Math.sin(progress * Math.PI) * (7 + i * 1.6)
    c.beginPath(); c.arc(x + side * distance, y - rise, 2 + (i % 2), 0, Math.PI * 2); c.fill()
  }
  c.restore()
}

export function SheepStage({ mood, flock = [], startsAt = 0, now = Date.now }: {
  mood: StageMood; flock?: SheepPass[]; startsAt?: number; now?: () => number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const surface = canvas.current
    const c = surface?.getContext('2d')
    if (!surface || !c) return
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    surface.width = W * scale; surface.height = H * scale
    c.setTransform(scale, 0, 0, scale, 0, 0)
    const scene = document.createElement('canvas')
    scene.width = surface.width; scene.height = surface.height
    const bg = scene.getContext('2d')!
    bg.scale(scale, scale); landscape(bg)
    const idleStart = performance.now()
    let frame = 0
    function draw(time: number) {
      if (!c) return
      c.drawImage(scene, 0, 0, W, H)
      if (mood === 'count') {
        const elapsed = now() - startsAt
        for (const pass of flock) {
          const progress = (elapsed - pass.at) / pass.travel
          if (progress >= 0 && progress <= 1) drawSheep(c, pass, progress)
        }
      } else if (mood === 'idle') {
        const progress = ((time - idleStart) % 3900) / 2400
        if (progress <= 1) drawSheep(c, { at: 0, travel: 2400, lane: 1, direction: -1, size: 1.45, bounce: 51, fleece: 0, hops: 2 }, progress)
      }
      sleeper(c, time, mood === 'idle' || mood === 'guess' || mood === 'result')
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [mood, flock, now, startsAt])
  return <canvas ref={canvas} className="sheep-canvas" role="img" aria-label={mood === 'count' ? 'Ovelhas entram no campo pelos dois lados' : 'Pessoa na cama sob a lua, em um campo lilás'}/>
}
