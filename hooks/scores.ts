export const TOP = 5

/** `m` goes on the board: the best TOP distances, highest first. */
export const record = (list: number[], m: number) => [...list, m].sort((a, b) => b - a).slice(0, TOP)
export const isBest = (list: number[], m: number) => m > (list[0] ?? 0)
export const board = (list: number[]) => (list.length ? list.map((m, i) => `${i + 1}. ${m}m`).join(' · ') : 'no runs yet')
/** What a saved board may hold, whatever the file says: finite positive numbers only. */
export const cleanBoard = (saved: unknown) =>
  Array.isArray(saved) ? saved.filter((m): m is number => Number.isFinite(m) && m > 0).sort((a, b) => b - a).slice(0, TOP) : []
