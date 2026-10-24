import { addDays } from "./day.ts"
import type { GameState } from "./game.ts"

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
  average: number
  cleared: number
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

export function loadGame(date: string): GameState | null {
  return read<GameState>(`hra:${date}`)
}

export function saveGame(date: string, state: GameState): void {
  write(`hra:${date}`, state)
}

export function loadResults(): Record<string, Result> {
  return read<Record<string, Result>>("vysledky") ?? {}
}

export function saveResult(date: string, result: Result): void {
  const results = loadResults()
  if (date in results) return
  write("vysledky", { ...results, [date]: result })
}

export function computeStats(results: Record<string, Result>, today: string): Stats {
  const daily = Object.entries(results).filter(([, r]) => r.daily)
  const days = new Set(daily.map(([date]) => date))

  let streak = 0
  let cursor = days.has(today) ? today : addDays(today, -1)
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }

  let bestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const date of [...days].sort()) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = date
  }

  const scores = Object.values(results).map((r) => r.score)
  return {
    played: Object.keys(results).length,
    streak,
    bestStreak,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    cleared: Object.values(results).filter((r) => r.cleared).length,
  }
}
