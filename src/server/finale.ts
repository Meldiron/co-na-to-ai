import "@tanstack/react-start/server-only"
import { AppwriteException, ID, Query, type Models } from "node-appwrite"
import { pragueDate } from "@/lib/day"
import { FINALE_GRACE_MS, FINALE_SECONDS, FINALE_SLOTS, finaleScore, scoreAnswer, weekOf, type FinaleAnswer, type FinaleQuestion } from "@/lib/finale"
import { guestName } from "@/lib/players"
import { DATABASE, appwrite } from "./appwrite"
import { namesOf } from "./games"

const BOARDS = "finales"
const GAMES = "finale_games"
const BOARDS_TTL_MS = 60_000

type BoardRow = Models.Row & { week: string; slot: number; question: string; passed: boolean; board: string | null; answered: number | null }
type GameRow = Models.Row & {
  userId: string
  week: string
  slot: number
  shownAt: string | null
  answers: string | null
  score: number
  status: "playing" | "finished"
  onTime: boolean | null
  finishedAt: string | null
}

export type FinaleReveal = { question: string; answer: FinaleAnswer; matched: string | null; top: { text: string; votes: number } }
export type FinaleView =
  | { status: "ready" }
  | { status: "playing"; slot: number; question: string; remainingMs: number }
  | { status: "finished"; score: number; onTime: boolean; reveal: Array<FinaleReveal> }

function db() {
  const remote = appwrite()
  if (!remote) throw new Error("Účty teď nejsou k dispozici.")
  return remote.tables
}

export const currentWeek = () => weekOf(pragueDate())

const boards = new Map<string, { at: number; questions: Array<FinaleQuestion> | null }>()

export async function loadFinale(week: string): Promise<Array<FinaleQuestion> | null> {
  const cached = boards.get(week)
  if (cached && (cached.questions || Date.now() - cached.at < BOARDS_TTL_MS)) return cached.questions
  const { rows } = await db().listRows<BoardRow>({
    databaseId: DATABASE,
    tableId: BOARDS,
    queries: [Query.equal("week", week), Query.equal("passed", true), Query.orderAsc("slot"), Query.limit(50)],
  })
  const bySlot = new Map(rows.map((r) => [r.slot, r]))
  const questions = Array.from({ length: FINALE_SLOTS }, (_, slot) => bySlot.get(slot)).every((r) => r?.board)
    ? Array.from({ length: FINALE_SLOTS }, (_, slot) => {
        const row = bySlot.get(slot)!
        const board = JSON.parse(row.board!) as Pick<FinaleQuestion, "answers" | "answered">
        return { slot, question: row.question, answered: board.answered, answers: board.answers }
      })
    : null
  boards.set(week, { at: Date.now(), questions })
  return questions
}

export async function finaleWeeks(): Promise<Array<string>> {
  const { rows } = await db().listRows<BoardRow>({
    databaseId: DATABASE,
    tableId: BOARDS,
    queries: [Query.equal("passed", true), Query.lessThanEqual("week", currentWeek()), Query.select(["week", "slot"]), Query.limit(5000)],
  })
  const slots = new Map<string, Set<number>>()
  for (const row of rows) slots.set(row.week, (slots.get(row.week) ?? new Set()).add(row.slot))
  return [...slots.entries()].filter(([, s]) => s.size >= FINALE_SLOTS).map(([week]) => week).sort().reverse()
}

async function findGame(userId: string, week: string): Promise<GameRow | null> {
  const { rows } = await db().listRows<GameRow>({ databaseId: DATABASE, tableId: GAMES, queries: [Query.equal("userId", userId), Query.equal("week", week), Query.limit(1)] })
  return rows[0] ?? null
}

function answersOf(row: GameRow): Array<FinaleAnswer> {
  return row.answers ? (JSON.parse(row.answers) as Array<FinaleAnswer>) : []
}

function view(row: GameRow | null, questions: Array<FinaleQuestion>): FinaleView {
  if (!row) return { status: "ready" }
  if (row.status === "finished") {
    return {
      status: "finished",
      score: row.score,
      onTime: row.onTime === true,
      reveal: answersOf(row).map((answer, slot) => {
        const { question, answers } = questions[slot]
        return { question, answer, matched: answer.index === null ? null : answers[answer.index].text, top: { text: answers[0].text, votes: answers[0].votes } }
      }),
    }
  }
  const elapsed = Date.now() - Date.parse(row.shownAt ?? new Date().toISOString())
  return { status: "playing", slot: row.slot, question: questions[row.slot].question, remainingMs: Math.max(0, FINALE_SECONDS * 1000 - elapsed) }
}

export async function finaleState(userId: string | null, week: string, questions: Array<FinaleQuestion>): Promise<FinaleView> {
  return view(userId ? await findGame(userId, week) : null, questions)
}

export async function startFinale(userId: string, week: string, questions: Array<FinaleQuestion>): Promise<FinaleView> {
  const existing = await findGame(userId, week)
  if (existing) return view(existing, questions)
  const data = { userId, week, slot: 0, shownAt: new Date().toISOString(), answers: "[]", score: 0, status: "playing" as const, onTime: null, finishedAt: null }
  try {
    const row = await db().createRow<GameRow>({ databaseId: DATABASE, tableId: GAMES, rowId: ID.unique(), data })
    return view(row, questions)
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 409)) throw error
    return view(await findGame(userId, week), questions)
  }
}

export async function answerFinale(userId: string, week: string, questions: Array<FinaleQuestion>, slot: number, text: string): Promise<FinaleView> {
  const row = await findGame(userId, week)
  if (!row || row.status === "finished" || row.slot !== slot) return view(row, questions)
  const late = Date.now() - Date.parse(row.shownAt ?? "") > FINALE_SECONDS * 1000 + FINALE_GRACE_MS
  const answers = [...answersOf(row), scoreAnswer(questions[slot], text, late)]
  const finished = answers.length >= FINALE_SLOTS
  const now = new Date().toISOString()
  const updated = await db().updateRow<GameRow>({
    databaseId: DATABASE,
    tableId: GAMES,
    rowId: row.$id,
    data: {
      slot: slot + 1,
      shownAt: finished ? null : now,
      answers: JSON.stringify(answers),
      score: finaleScore(answers),
      status: finished ? "finished" : "playing",
      onTime: finished ? week === currentWeek() : null,
      finishedAt: finished ? now : null,
    },
  })
  return view(updated, questions)
}

export type FinaleLeaderboard = {
  players: number
  winners: number
  leaders: Array<{ rank: number; name: string; score: number; me: boolean }>
  me: { rank: number; score: number } | null
}

export async function finaleLeaderboard(week: string, goal: number, userId: string | null): Promise<FinaleLeaderboard> {
  const { rows } = await db().listRows<GameRow>({
    databaseId: DATABASE,
    tableId: GAMES,
    queries: [Query.equal("week", week), Query.equal("status", "finished"), Query.equal("onTime", true), Query.select(["userId", "score", "finishedAt"]), Query.limit(5000)],
  })
  rows.sort((a, b) => b.score - a.score || (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""))
  const rankOf = (score: number) => 1 + rows.filter((r) => r.score > score).length
  const top = rows.slice(0, 10)
  const names = await namesOf(top.map((r) => r.userId))
  const mine = userId ? rows.find((r) => r.userId === userId) : undefined
  return {
    players: rows.length,
    winners: rows.filter((r) => r.score >= goal).length,
    leaders: top.map((r) => ({ rank: rankOf(r.score), name: names.get(r.userId) ?? guestName(r.userId), score: r.score, me: r.userId === userId })),
    me: mine ? { rank: rankOf(mine.score), score: mine.score } : null,
  }
}
