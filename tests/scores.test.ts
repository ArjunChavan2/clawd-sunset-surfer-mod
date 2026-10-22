import { test, expect } from 'claude-code/testing'
import { board, cleanBoard, isBest, record } from '../hooks/scores'
import { frameRows } from '../hooks/world'

test('the board keeps the top 5, highest first, and knows a new best', () => {
  let list: number[] = []
  for (const m of [40, 90, 10, 70, 55, 100, 20]) list = record(list, m)
  expect(list).toEqual([100, 90, 70, 55, 40])
  expect(isBest(list, 101)).toBe(true)
  expect(isBest(list, 100)).toBe(false)
  expect(isBest([], 12)).toBe(true)
  expect(board(list)).toBe('1. 100m · 2. 90m · 3. 70m · 4. 55m · 5. 40m')
  expect(board([])).toBe('no runs yet')
})

test('a saved board is cleaned: junk, negatives and extras are dropped', () => {
  expect(cleanBoard('runner')).toEqual([])
  expect(cleanBoard(undefined)).toEqual([])
  expect(cleanBoard([5, 'x', -3, NaN, 80, 0, 60, 40, 30, 20, 10])).toEqual([80, 60, 40, 30, 20])
})

test('the band shows the best beside the live distance, gold once passed', () => {
  const top = (t: number, best: number) => frameRows(t, 50, 1234, best)[0]
  expect(top(20, 0).map(r => r.text).join('')).toContain('20m')
  expect(top(20, 0).map(r => r.text).join('')).not.toContain('best')
  expect(top(20, 90).map(r => r.text).join('')).toContain('best 90m')
  expect(top(20, 90).some(r => r.color === '#ffd23f')).toBe(false)
  expect(top(95, 90).some(r => r.color === '#ffd23f')).toBe(true)
})
