// A behind-the-runner view drawn as pixels (a half block per cell: two pixels tall) with real perspective:
// sky, sun, hills, a striped road that streams toward you, haze with distance, and shaded 3D boxes.
export const H = 10 // terminal rows; the picture is 2H pixels tall
export const FRAME_MS = 80
export const MAX_STAGE = 50
export const ORANGE = '#D77757'
const S = 12 // ticks between events
const PLAT = 6 // ticks a platform stays underfoot
const C = 4 // perspective: a thing d ticks ahead has scale C / (d + C): 1 at the runner, toward 0 at the horizon
const PH = H * 2
const HOR = 6 // the horizon's pixel row
const BOT = PH - 1
const HS = 8 // pixels per world unit of height at scale 1
const AHEAD = 40 // how far down the track things are drawn, in ticks

type RGB = [number, number, number]
export type Run = { text: string; color: string; bg: string }
type Kind = 'none' | 'jump' | 'slide' | 'platform'
const KINDS: Kind[] = ['none', 'jump', 'slide', 'platform']

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
const mul = (c: RGB, k: number): RGB => c.map(v => Math.min(255, Math.round(v * k))) as RGB
const hex = (c: RGB) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
const rgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB

const SKY_TOP: RGB = [16, 8, 48]
const HAZE: RGB = [214, 104, 130]
const ROAD: [RGB, RGB] = [[70, 66, 92], [60, 56, 80]]
const GRASS: [RGB, RGB] = [[46, 30, 84], [38, 24, 72]]
const LINE: RGB = [235, 225, 210]
const RUMBLE: [RGB, RGB] = [[220, 70, 80], [235, 235, 240]]

/** A cheap deterministic hash: the same (seed, k) always gives the same course, with no state. */
const hash = (seed: number, k: number) => {
  let x = (Math.imul(k + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b)) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0
  return (x ^ (x >>> 12)) >>> 0
}

/** What event slot `k` holds, in the lane the autopilot will be in: the first two slots are a clear run-up. */
export const kindAt = (seed: number, k: number): Kind => (k < 2 ? 'none' : KINDS[hash(seed, k) % 4])
export const laneAt = (seed: number, k: number) => (k < 2 ? 1 : hash(seed, k + 100) % 3)
/** A decoy wall in `lane` at slot `k`: never in the autopilot's own lane, there only to make the lane changes make sense. */
export const hasWall = (seed: number, k: number, lane: number) => k >= 2 && lane !== laneAt(seed, k) && hash(seed, k * 3 + lane + 300) % 2 === 0

/** What the runner is doing at tick `t`: its lane (halfway while changing), height in world units, sliding or not. */
export const pose = (seed: number, t: number) => {
  const k = Math.floor(t / S)
  const ph = t - k * S
  const cur = laneAt(seed, k)
  const nxt = laneAt(seed, k + 1)
  // changes lane over the last ticks of a slot, before the next event's reach starts
  const lane = ph >= S - 2 ? nxt : ph >= S - 4 ? (cur + nxt) / 2 : cur
  let up = 0
  let slide = false
  let onPlat = false
  for (let j = k - 1; j <= k + 1; j++) {
    const d = j * S - t
    const kind = kindAt(seed, j)
    if (kind === 'jump' && Math.abs(d) <= 3) up = Math.max(up, 1 - (d / 3.2) ** 2) // an arc over the bar
    else if (kind === 'slide' && Math.abs(d) <= 2) slide = true
    else if (kind === 'platform') {
      if (d <= 0 && d + PLAT > 0) {
        up = Math.max(up, 0.5)
        onPlat = true
      } else if (d === 1) up = Math.max(up, 0.9) // the hop onto it
    }
  }
  return { lane, up, slide, onPlat }
}

// Clawd from behind: O body, L lit top, D shaded underside; the legs swap on alternate ticks
const BODY = ['.LLLLLLL.', 'OOOOOOOOO', 'OOOOOOOOO', '.OOOOOOO.', '.DDDDDDD.']
const LEGS = ['.OO...OO.', '..OO.OO..']
const SLID = ['.LLLLLLL.', 'OOOOOOOOO', '.DDDDDDD.']
const PALETTE: Record<string, RGB> = { O: rgb(ORANGE), L: [245, 160, 125], D: [160, 84, 58] }

type Box = { x0: number; x1: number; y0: number; y1: number; dN: number; dF: number; base: RGB; stripe?: RGB; before: boolean }

/** The stage at tick `t` as H rows of runs, each exactly `width` columns. */
export const frameRows = (t: number, width: number, seed: number, best = 0): Run[][] => {
  const W = width
  const cx = Math.floor(W / 2)
  const f = W * 0.28 // world x to pixels at scale 1: the road (±1.5) fills most of the width
  const px: RGB[][] = Array.from({ length: PH }, () => Array.from({ length: W }, () => SKY_TOP))
  const put = (x: number, y: number, c: RGB) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < W && y >= 0 && y < PH) px[y][x] = c
  }
  const fog = (c: RGB, s: number) => mix(c, HAZE, 0.9 * Math.max(0, Math.min(1, 1 - s)) ** 1.7)
  const Y = (s: number, h: number) => HOR + s * (BOT - HOR - h * HS) // screen row of height h at scale s
  const X = (x: number, s: number) => cx + x * f * s

  // sky, sun, hills
  for (let y = 0; y <= HOR; y++) for (let x = 0; x < W; x++) px[y][x] = mix(SKY_TOP, HAZE, (y / HOR) ** 1.4)
  for (let y = 0; y <= HOR; y++)
    for (let x = 0; x < W; x++)
      if ((x - cx) ** 2 + (HOR - y) ** 2 <= 25) px[y][x] = mix([255, 214, 90], [255, 84, 140], (HOR - y) / 5)
  for (let x = 0; x < W; x++) {
    const hill = Math.round(1.6 + 1.3 * Math.sin(x * 0.42) + 1.1 * Math.sin(x * 0.15 + 2))
    for (let y = HOR - Math.max(0, hill); y <= HOR; y++) px[y][x] = [44, 22, 78]
  }

  // the road streams toward you: bands are fixed in the world, so they move as t does
  for (let y = HOR + 1; y <= BOT; y++) {
    const s = (y - HOR) / (BOT - HOR)
    const world = C * (1 / s - 1) + t
    const band = Math.floor(world / 3) % 2
    const strip = Math.floor(world / 1.5) % 2
    for (let x = 0; x < W; x++) {
      const aX = Math.abs((x - cx) / (f * s))
      let c: RGB
      if (aX <= 1.5) c = Math.abs(aX - 0.5) * f * s < 0.7 && strip === 0 ? LINE : ROAD[band]
      else if (aX <= 1.72) c = RUMBLE[strip]
      else c = GRASS[band]
      px[y][x] = fog(c, s)
    }
  }

  // things on the road, far to near
  const boxes: Box[] = []
  const add = (b: Omit<Box, 'before'> & { before?: boolean }) => boxes.push({ before: b.dN > 0.5, ...b })
  for (let k = Math.floor(t / 6) - 1; k <= Math.floor((t + AHEAD) / 6); k++)
    for (const side of [-1, 1]) // pylons along both edges: the cheapest cue for speed
      add({ x0: side * 1.95 - 0.12, x1: side * 1.95 + 0.12, y0: 0, y1: 0.9, dN: k * 6 - t, dF: k * 6 - t + 0.5, base: k % 2 ? [120, 70, 150] : [60, 170, 190] })
  for (let k = Math.floor(t / S) - 1; k <= Math.floor((t + AHEAD) / S); k++) {
    const d = k * S - t
    const kind = kindAt(seed, k)
    const l = laneAt(seed, k) - 1
    if (kind === 'jump') add({ x0: l - 0.46, x1: l + 0.46, y0: 0, y1: 0.4, dN: d, dF: d + 0.8, base: [225, 70, 80], stripe: [240, 240, 245] })
    if (kind === 'platform') add({ x0: l - 0.48, x1: l + 0.48, y0: 0, y1: 0.5, dN: d, dF: d + PLAT, base: [60, 150, 168], before: true })
    if (kind === 'slide') {
      const gold: RGB = [235, 190, 80]
      add({ x0: l - 0.46, x1: l - 0.34, y0: 0, y1: 1.1, dN: d, dF: d + 0.4, base: mul(gold, 0.8) })
      add({ x0: l + 0.34, x1: l + 0.46, y0: 0, y1: 1.1, dN: d, dF: d + 0.4, base: mul(gold, 0.8) })
      add({ x0: l - 0.46, x1: l + 0.46, y0: 0.5, y1: 0.9, dN: d, dF: d + 0.4, base: gold })
    }
    for (let m = 0; m < 3; m++) if (hasWall(seed, k, m)) add({ x0: m - 1 - 0.46, x1: m - 1 + 0.46, y0: 0, y1: 1, dN: d, dF: d + 1, base: [150, 62, 74] })
  }
  boxes.sort((a, b) => b.dN - a.dN)

  const drawBox = (b: Box) => {
    if (b.dN + C <= 0.4 || b.dF + C <= 0.4) return
    if (!b.before && b.dN < 0) return // past the camera: gone, not a huge blob over the runner
    const sN = C / (b.dN + C)
    const sF = C / (b.dF + C)
    const top = mul(b.base, 1.35)
    const side = mul(b.base, 0.6)
    const plane = b.x1 < 0 ? b.x1 : b.x0 > 0 ? b.x0 : null // the face turned toward the middle of the road
    if (plane !== null)
      for (let x = 0; x < W; x++) {
        const s = (x - cx) / (plane * f)
        if (s < sF || s > sN) continue
        for (let y = Math.round(Y(s, b.y1)); y <= Math.round(Y(s, b.y0)); y++) put(x, y, fog(side, s))
      }
    for (let y = Math.max(0, Math.floor(Y(sF, b.y1))); y <= Math.min(BOT, Math.ceil(Y(sN, b.y1))); y++) {
      const s = (y - HOR) / (BOT - HOR - b.y1 * HS)
      if (s < sF || s > sN) continue
      for (let x = Math.round(X(b.x0, s)); x <= Math.round(X(b.x1, s)); x++) put(x, y, fog(top, s))
    }
    if (sN <= 2.6)
      for (let x = Math.round(X(b.x0, sN)); x <= Math.round(X(b.x1, sN)); x++) {
        const c = b.stripe && Math.floor(x / 2) % 2 ? b.stripe : b.base
        for (let y = Math.round(Y(sN, b.y1)); y <= Math.round(Y(sN, b.y0)); y++) put(x, y, fog(c, sN))
      }
  }

  const { lane, up, slide, onPlat } = pose(seed, t)
  boxes.filter(b => b.before).forEach(drawBox)
  const rx = Math.round(cx + (lane - 1) * f)
  const feet = BOT - Math.round(up * HS)
  if (up > 0.04 && !onPlat)
    for (let y = BOT - 1; y <= BOT; y++) for (let x = rx - 4; x <= rx + 4; x++) if (x >= 0 && x < W) px[y][x] = mul(px[y][x], 0.45)
  const sprite = slide ? SLID : [...BODY, LEGS[t % 2]]
  sprite.forEach((row, i) =>
    [...row].forEach((ch, j) => PALETTE[ch] && put(rx - 4 + j, feet - (sprite.length - 1 - i), PALETTE[ch])),
  )
  boxes.filter(b => !b.before).forEach(drawBox)

  // pack two pixel rows into one cell: the top pixel is the block's colour, the bottom its background
  const cells = Array.from({ length: H }, (_, r) =>
    Array.from({ length: W }, (_, x) => ({ ch: '▀', color: hex(px[2 * r][x]), bg: hex(px[2 * r + 1][x]) })),
  )
  // the live distance, with the personal best beside it; gold once this run passes it
  const score = best ? `${t}m  best ${best}m` : `${t}m`
  const ink = best && t > best ? '#ffd23f' : '#ffffff'
  for (let i = 0; i < score.length && W - score.length + i >= 0; i++) {
    const c = cells[0][W - score.length + i]
    cells[0][W - score.length + i] = { ch: score[i], color: ink, bg: c.color }
  }
  return cells.map(r => {
    const runs: Run[] = []
    for (const c of r) {
      const last = runs[runs.length - 1]
      if (last && last.color === c.color && last.bg === c.bg && c.ch === '▀' && last.text.endsWith('▀')) last.text += c.ch
      else runs.push({ text: c.ch, color: c.color, bg: c.bg })
    }
    return runs
  })
}
