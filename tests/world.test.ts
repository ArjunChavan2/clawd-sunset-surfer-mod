import { test, expect } from 'claude-code/testing'
import { H, ORANGE, frameRows, hasWall, kindAt, laneAt, pose } from '../hooks/world'

const SEED = 1234
const TICKS = 3000

test('every frame is H rows of exactly `width` columns, with the runner drawn in it', () => {
  for (const width of [30, 44, 50])
    for (let t = 0; t < 400; t++) {
      const rows = frameRows(t, width, SEED)
      expect(rows.length).toBe(H)
      for (const r of rows) expect(r.map(x => x.text).join('').length).toBe(width)
      // the runner's body is Clawd orange, undimmed by haze: some cell shows it as ink or background
      const orange = rows.flat().filter(x => x.color === ORANGE.toLowerCase() || x.bg === ORANGE.toLowerCase()).length
      expect(orange).toBeGreaterThan(0)
    }
})

test('the course uses all three events and all three lanes, and never puts a wall in the runner\'s lane', () => {
  const kinds = new Set<string>()
  const lanes = new Set<number>()
  for (let k = 2; k < TICKS / 12; k++) {
    kinds.add(kindAt(SEED, k))
    lanes.add(laneAt(SEED, k))
    expect(hasWall(SEED, k, laneAt(SEED, k))).toBe(false)
  }
  expect([...kinds].sort()).toEqual(['jump', 'none', 'platform', 'slide'])
  expect([...lanes].sort()).toEqual([0, 1, 2])
})

test('the runner is in the right lane and the right pose when each event reaches it', () => {
  for (let k = 2; k < TICKS / 12; k++) {
    const p = pose(SEED, k * 12)
    const kind = kindAt(SEED, k)
    if (kind === 'none') continue
    expect(p.lane).toBe(laneAt(SEED, k))
    if (kind === 'jump') expect(p.up).toBeGreaterThan(0.9)
    if (kind === 'slide') expect(p.slide).toBe(true)
    if (kind === 'platform') expect(p.up).toBe(0.5)
  }
})
