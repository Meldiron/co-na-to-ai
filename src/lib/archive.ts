import { FINALE_GOAL, finaleNumber, weekOf } from "./finale.ts"
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
