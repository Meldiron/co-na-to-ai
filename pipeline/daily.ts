import { addDays } from "../src/lib/day.ts"
import type { Question } from "../src/lib/types.ts"

export const DAYS_AHEAD = 3
export const MAX_ATTEMPTS = 3

export type Attempt = { date: string; questionId: string; passed: boolean }

export function targetDates(today: string): Array<string> {
  return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i))
}

export function pickQuestion(questions: Array<Question>, reserves: Array<Question>, attempts: Array<Attempt>, date: string): Question | null {
  if (attempts.filter((a) => a.date === date).length >= MAX_ATTEMPTS) return null
  const tried = new Set(attempts.map((a) => a.questionId))
  const usable = (q: Question) => q.status === "approved" && !tried.has(q.id)
  return questions.find((q) => q.date === date && usable(q)) ?? reserves.find((q) => !q.date && usable(q)) ?? null
}
