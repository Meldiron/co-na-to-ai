import { FINALE_GOAL, finaleNumber, weekOf } from "./finale.ts"
import type { Result } from "./storage.ts"
import type { PuzzleSummary } from "./types.ts"

export type FinaleOutcome = { status: "playing" | "finished"; score: number }
export type ArchiveDay = { date: string; number: number; question: string; result: Result | null }
export type ArchiveWeek = { week: string; number: number; result: FinaleOutcome | null }
export type Archive = { today: string; week: string; days: Array<ArchiveDay>; weeks: Array<ArchiveWeek>; loaded: boolean }

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

export type Mark = { played: boolean; perfect: boolean; live: boolean }

export function dayMark(day: ArchiveDay, today: string): Mark {
  return { played: !!day.result, perfect: !!day.result?.cleared, live: day.date === today }
}

export function weekMark(week: ArchiveWeek, current: string): Mark {
  const played = finished(week)
  return { played, perfect: played && (week.result?.score ?? 0) >= FINALE_GOAL, live: week.week === current }
}

export const finished = (week: ArchiveWeek) => week.result?.status === "finished"

export function monthsOf(archive: Archive): Array<string> {
  return [...new Set([...archive.days.map((d) => d.date.slice(0, 7)), ...archive.weeks.map((w) => w.week.slice(0, 7))])].sort().reverse()
}
