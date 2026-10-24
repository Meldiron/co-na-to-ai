import { addDays, daysBetween, formatDayMonth, isValidDate } from "./day.ts"
import { matchGuess } from "./match.ts"
import type { BoardAnswer } from "./types.ts"

export const FINALE_SLOTS = 5
export const FINALE_SECONDS = 30
export const FINALE_GRACE_MS = 3000
export const FINALE_GOAL = 100
export const FINALE_LAUNCH = "2026-10-05"

export type FinaleQuestion = { slot: number; question: string; answered: number; answers: Array<Pick<BoardAnswer, "rank" | "text" | "votes" | "aliases">> }
export type FinaleAnswer = { text: string; index: number | null; points: number; late: boolean }

export function weekOf(date: string): string {
  return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
}

export function isFinaleWeek(week: string, current: string): boolean {
  return isValidDate(week) && weekOf(week) === week && week >= FINALE_LAUNCH && week <= current
}

export function finaleSchedule(today: string): Array<string> {
  const current = weekOf(today)
  const older = Array.from({ length: Math.max(0, daysBetween(FINALE_LAUNCH, current) / 7) }, (_, i) => addDays(current, -7 * (i + 1)))
  return [current, addDays(current, 7), ...older]
}

export function finaleNumber(week: string): number {
  return daysBetween(FINALE_LAUNCH, week) / 7 + 1
}

export function weekLabel(week: string): string {
  return `${formatDayMonth(week)} – ${formatDayMonth(addDays(week, 6))}`
}

export function scoreAnswer(question: FinaleQuestion, text: string, late: boolean): FinaleAnswer {
  const cleaned = text.trim().slice(0, 40)
  const match = late || !cleaned ? null : matchGuess(cleaned, question.answers, new Set())
  return match?.kind === "hit" ? { text: cleaned, index: match.index, points: question.answers[match.index].votes, late } : { text: cleaned, index: null, points: 0, late }
}

export function timeUp(answers: Array<FinaleAnswer>): Array<FinaleAnswer> {
  return [...answers, ...Array.from({ length: Math.max(0, FINALE_SLOTS - answers.length) }, () => ({ text: "", index: null, points: 0, late: true }))]
}

export function finaleScore(answers: Array<FinaleAnswer>): number {
  return answers.reduce((sum, a) => sum + a.points, 0)
}

export function finaleShareText(week: string, answers: Array<FinaleAnswer>, url: string): string {
  const tiles = answers.map((a) => (a.index === 0 ? "🟩" : a.index === null ? "⬜" : "🟨")).join("")
  const score = finaleScore(answers)
  return [`Co na to AI · Finále č. ${finaleNumber(week)}`, `${tiles} ${score} ${score >= FINALE_GOAL ? "bodů, vyhráno" : "bodů"}`, url].join("\n")
}
