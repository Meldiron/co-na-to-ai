import { matchGuess, normalize } from "./match.ts"
import type { BoardAnswer } from "./types.ts"

export const MAX_STRIKES = 5
export const CLEAR_BONUS = 20

export type Guess = {
  text: string
  result: "hit" | "miss"
  index?: number
}

export type GameState = {
  found: Array<number>
  guesses: Array<Guess>
  strikes: number
  status: "playing" | "won" | "lost"
}

export type GuessOutcome =
  | { kind: "hit"; index: number }
  | { kind: "miss" }
  | { kind: "repeat"; index: number }
  | { kind: "repeat-miss" }
  | { kind: "empty" }
  | { kind: "over" }

export const initialState: GameState = {
  found: [],
  guesses: [],
  strikes: 0,
  status: "playing",
}

export function applyGuess(
  state: GameState,
  answers: Array<BoardAnswer>,
  text: string,
): { state: GameState; outcome: GuessOutcome } {
  if (state.status !== "playing") return { state, outcome: { kind: "over" } }
  const cleaned = text.trim()
  if (!normalize(cleaned)) return { state, outcome: { kind: "empty" } }

  const result = matchGuess(cleaned, answers, new Set(state.found))
  if (result.kind === "repeat") return { state, outcome: result }

  if (result.kind === "hit") {
    const found = [...state.found, result.index]
    return {
      state: {
        ...state,
        found,
        guesses: [...state.guesses, { text: cleaned, result: "hit", index: result.index }],
        status: found.length === answers.length ? "won" : "playing",
      },
      outcome: result,
    }
  }

  const key = normalize(cleaned)
  if (state.guesses.some((g) => g.result === "miss" && normalize(g.text) === key)) {
    return { state, outcome: { kind: "repeat-miss" } }
  }

  const strikes = state.strikes + 1
  return {
    state: {
      ...state,
      strikes,
      guesses: [...state.guesses, { text: cleaned, result: "miss" }],
      status: strikes >= MAX_STRIKES ? "lost" : "playing",
    },
    outcome: { kind: "miss" },
  }
}

export function giveUp(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "lost" } : state
}

export function scoreLines(state: GameState, answers: Array<BoardAnswer>) {
  const lines = state.found
    .map((i) => answers[i])
    .sort((a, b) => a.rank - b.rank)
    .map((a) => ({ label: a.text, rank: a.rank, points: a.votes }))
  const bonus = state.found.length === answers.length ? CLEAR_BONUS : 0
  const total = lines.reduce((sum, l) => sum + l.points, 0) + bonus
  return { lines, bonus, total }
}

export function maxScore(answers: Array<BoardAnswer>): number {
  return answers.reduce((sum, a) => sum + a.votes, 0) + CLEAR_BONUS
}

export function shareText(opts: {
  label: string
  state: GameState
  answers: Array<BoardAnswer>
  total: number
  url: string
}): string {
  const { label, state, answers, total, url } = opts
  const board = answers
    .map((_, i) => (state.found.includes(i) ? "🟩" : "⬜"))
    .join("")
  const guesses = state.guesses.map((g) => (g.result === "hit" ? "🟩" : "🟥")).join("")
  return [
    `Ptali jsme se 100 AI · ${label}`,
    `${board} ${state.found.length}/${answers.length}`,
    guesses,
    `${total} ${pointsWord(total)}`,
    url,
  ].join("\n")
}

const plural = new Intl.PluralRules("cs-CZ")
const pointWords: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "bod", few: "body" }

export function pointsWord(n: number): string {
  return pointWords[plural.select(n)] ?? "bodů"
}
