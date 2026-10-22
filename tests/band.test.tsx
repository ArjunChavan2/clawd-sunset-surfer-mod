import { test, expect, mock } from 'claude-code/testing'

const BAND = { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 80 } as any
const shown = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

// 'runner' is the saved band: the runner draws instead of Clawd, keeps the mods beneath, and animates only while a turn runs
test('with the runner band the runner draws and animates during a turn, then leaves', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: 'runner' }))
  on('store.set', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-mods', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const frames = new Set<string>()
  for (let i = 0; i < 12; i++) {
    frames.add(await shown(ui))
    await clock.advance(100)
  }
  expect(frames.size).toBeGreaterThan(1)
  expect(await shown(ui)).toContain('▀') // the runner's half blocks
  expect(await shown(ui)).toContain('below')

  await $.turn.complete({ reason: 'answered', turnId: 't1' } as any)
  await ui.redraw({ ...BAND, isWorking: false })
  expect(await shown(ui)).toBe('below')
})

test('a runner turn lands on the saved board, a new best toasts, and /runner scores and reset work', async ($, on) => {
  const clock = mock.clock(on)
  const saved: unknown[] = []
  const toasts: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('store.get', (_, e: any) => ({ value: e.key === 'band' ? 'runner' : e.key === 'scores' ? [30] : undefined }))
  on('store.set', (_, e: any) => (e.key === 'scores' && saved.push(e.value), { value: undefined }))
  on('ui.toast', (_, e: any) => (toasts.push(e.text), { value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  await clock.advance(80 * 60) // a minute-ish of ticks: well past the saved 30m
  await $.turn.complete({ reason: 'answered', turnId: 't1' } as any)
  expect((saved.at(-1) as number[])[0]).toBeGreaterThan(30)
  expect((saved.at(-1) as number[]).includes(30)).toBe(true)
  expect(toasts.some(t => t.startsWith('New best: '))).toBe(true)

  await $.command.run({ command: 'runner', args: 'scores' } as any)
  expect(toasts.at(-1)).toMatch(/^Best runs: 1\. \d+m · 2\. 30m$/)
  await $.command.run({ command: 'runner', args: 'reset' } as any)
  expect(saved.at(-1)).toEqual([])
  expect(toasts.at(-1)).toBe('Scores cleared')
})
