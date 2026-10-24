import { daysBetween } from "./day.ts"

export const FREEZES = 2

export type Streak = { current: number; best: number; freezesLeft: number; missed: number }

export function streak(played: Iterable<string>, today: string): Streak {
  const days = [...new Set(played)].filter((d) => d <= today).sort()
  if (days.length === 0) return { current: 0, best: 0, freezesLeft: FREEZES, missed: 0 }

  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) - 1 <= FREEZES ? run + 1 : 1
    best = Math.max(best, run)
  }

  const last = days[days.length - 1]
  const missed = last === today ? 0 : daysBetween(last, today) - 1
  if (missed > FREEZES) return { current: 0, best, freezesLeft: FREEZES, missed }
  return { current: run, best, freezesLeft: FREEZES - missed, missed }
}
