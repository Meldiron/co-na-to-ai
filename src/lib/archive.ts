import { LAUNCH_DATE, addDays, puzzleNumber } from "./day.ts"
import { FINALE_GOAL, FINALE_LAUNCH, finaleNumber, weekOf } from "./finale.ts"
import type { Result } from "./storage.ts"
import type { PuzzleSummary } from "./types.ts"

export type FinaleOutcome = { status: "playing" | "finished"; score: number }
export type ArchiveDay = { date: string; number: number; question: string; result: Result | null }
export type ArchiveWeek = { week: string; number: number; result: FinaleOutcome | null }
export type Archive = { today: string; week: string; days: Array<ArchiveDay>; weeks: Array<ArchiveWeek>; loaded: boolean }
export type Tone = "cleared" | "played" | "open" | "today"

export function buildArchive(input: {
  today: string
  puzzles: Array<PuzzleSummary>
  finales: Array<string>
  results: Record<string, Result> | null
  finaleResults: Record<string, FinaleOutcome> | null
}): Archive {
  const { today, results, finaleResults } = input
  return {
    today,
    week: weekOf(today),
    days: input.puzzles.map((p) => ({ date: p.date, number: p.number, question: p.question, result: results && p.date in results ? results[p.date] : null })),
    weeks: input.finales.map((week) => ({ week, number: finaleNumber(week), result: finaleResults && week in finaleResults ? finaleResults[week] : null })),
    loaded: results !== null,
  }
}

export function dayTone(day: ArchiveDay, today: string): Tone {
  if (day.date === today) return "today"
  if (!day.result) return "open"
  return day.result.cleared ? "cleared" : "played"
}

export function weekTone(week: ArchiveWeek, current: string): Tone {
  if (week.week === current) return "today"
  if (week.result?.status !== "finished") return "open"
  return week.result.score >= FINALE_GOAL ? "cleared" : "played"
}

export const finished = (week: ArchiveWeek) => week.result?.status === "finished"

export function monthsOf(archive: Archive): Array<string> {
  return [...new Set([...archive.days.map((d) => d.date.slice(0, 7)), ...archive.weeks.map((w) => w.week.slice(0, 7))])].sort().reverse()
}

export function unplayed(archive: Archive): { days: number; weeks: number } {
  return { days: archive.days.filter((d) => !d.result).length, weeks: archive.weeks.filter((w) => !finished(w)).length }
}

function random(seed: number): () => number {
  let t = seed
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const MOCK_TODAY = "2027-10-24"

export function mockArchive(questions: Array<string>): Archive {
  const next = random(2027)
  const days: Array<ArchiveDay> = []
  for (let date = MOCK_TODAY; date >= LAUNCH_DATE; date = addDays(date, -1)) {
    const number = puzzleNumber(date)
    const played = date !== MOCK_TODAY && next() < 0.7
    const found = played ? Math.min(8, Math.floor(next() * 9)) : 0
    const cleared = found === 8
    days.push({
      date,
      number,
      question: questions[(number - 1) % questions.length],
      result: played ? { score: found * 90 + Math.floor(next() * 60) + (cleared ? 200 : 0), found, strikes: cleared ? Math.floor(next() * 5) : 5, cleared, daily: next() < 0.8 } : null,
    })
  }
  const weeks: Array<ArchiveWeek> = []
  for (let week = weekOf(MOCK_TODAY); week >= FINALE_LAUNCH; week = addDays(week, -7)) {
    const played = week !== weekOf(MOCK_TODAY) && next() < 0.6
    weeks.push({ week, number: finaleNumber(week), result: played ? { status: "finished", score: Math.floor(40 + next() * 120) } : null })
  }
  return { today: MOCK_TODAY, week: weekOf(MOCK_TODAY), days, weeks, loaded: true }
}
