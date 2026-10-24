import type { GameState } from "./game.ts"
import { streak } from "./streak.ts"

const PREFIX = "pjs100"

export type Result = {
  score: number
  found: number
  strikes: number
  cleared: boolean
  daily: boolean
}

export type Stats = {
  played: number
  streak: number
  bestStreak: number
  freezesLeft: number
  missed: number
  average: number
  best: number
  cleared: number
  distribution: Array<number>
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
  } catch {
    // storage full or blocked: the game still works for this visit
  }
}

type SavedGame = GameState & { board?: string }

export function loadGame(key: string, board: string): GameState | null {
  const saved = read<SavedGame>(`hra:${key}`)
  if (!saved) return null
  if (saved.board === board) return saved
  clearResult(key)
  return null
}

export function saveGame(key: string, board: string, state: GameState): void {
  write(`hra:${key}`, { ...state, board })
}

function clearResult(date: string): void {
  const results = loadResults()
  if (!(date in results)) return
  delete results[date]
  write("vysledky", results)
}

export type LocalGame = { key: string; board: string; state: GameState }

export function localGames(): Array<LocalGame> {
  const games: Array<LocalGame> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)
      if (!name?.startsWith(`${PREFIX}:hra:`)) continue
      const key = name.slice(`${PREFIX}:hra:`.length)
      const saved = read<SavedGame>(`hra:${key}`)
      if (saved?.board) games.push({ key, board: saved.board, state: saved })
    }
  } catch {
    return games
  }
  return games
}

export function forgetLocalGames(): void {
  try {
    const names = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
      (name): name is string => !!name && (name.startsWith(`${PREFIX}:hra:`) || name === `${PREFIX}:vysledky` || name === `${PREFIX}:sync`),
    )
    for (const name of names) localStorage.removeItem(name)
  } catch {
    // nothing stored, nothing to forget
  }
}

export function syncedFor(): string | null {
  return read<string>("sync")
}

export function markSynced(userId: string): void {
  write("sync", userId)
}

export function guideSeen(): boolean {
  return read<boolean>("navod") === true
}

export function markGuideSeen(): void {
  write("navod", true)
}

export function loadResults(): Record<string, Result> {
  return read<Record<string, Result>>("vysledky") ?? {}
}

export const RESULTS_EVENT = "pjs100:vysledky"

export function saveResult(date: string, result: Result): void {
  const results = loadResults()
  if (date in results) return
  write("vysledky", { ...results, [date]: result })
  window.dispatchEvent(new Event(RESULTS_EVENT))
}

export function computeStats(results: Record<string, Result>, today: string): Stats {
  const days = Object.entries(results)
    .filter(([, r]) => r.daily)
    .map(([date]) => date)
  const run = streak(days, today)
  const all = Object.values(results)
  const scores = all.map((r) => r.score)
  const distribution = Array.from({ length: 9 }, (_, found) => all.filter((r) => r.found === found).length)
  return {
    played: all.length,
    streak: run.current,
    bestStreak: run.best,
    freezesLeft: run.freezesLeft,
    missed: run.missed,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
    cleared: all.filter((r) => r.cleared).length,
    distribution,
  }
}
