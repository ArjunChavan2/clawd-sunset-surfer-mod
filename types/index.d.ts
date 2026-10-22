export type Frame = number
/** The turn's show, which a hot reload keeps: whether a turn runs, the frame it started on, the rotation's seed and acts played. */
export type Show = { isTurnRunning: boolean; turnBase: number; seed: number; played: number }
/** Which act draws above the prompt. */
export type Band = 'clawd' | 'runner'

declare module 'claude-code' {
  interface PluginState {
    'clawd-mods': { frame: Frame; show: Show; band: Band }
  }
}
