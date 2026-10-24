import { matchGuess, normalize } from "./match.ts"
import type { BoardAnswer } from "./types.ts"

export const MAX_STRIKES = 5
export const POINTS_PER_VOTE = 10
export const HINT_PENALTY = 0.25
export const MAX_LETTER_HINTS = 3
export const CLEAR_BONUS = 200

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
  hints?: Array<number>
  clues?: Array<number>
}

export type GuessOutcome =
  | { kind: "hit"; index: number }
  | { kind: "miss" }
  | { kind: "repeat"; index: number }
  | { kind: "repeat-miss" }
  | { kind: "empty" }
  | { kind: "multi" }
  | { kind: "over" }

export const initialState: GameState = {
  found: [],
  guesses: [],
  strikes: 0,
  status: "playing",
  hints: [],
  clues: [],
}

const LETTER = /\p{L}/u

export function hintsUsed(state: GameState, index: number): number {
  return state.hints?.[index] ?? 0
}

export function maxHints(answer: Pick<BoardAnswer, "text">): number {
  const letters = [...answer.text].filter((ch) => LETTER.test(ch)).length
  return Math.max(0, Math.min(MAX_LETTER_HINTS, letters - 1))
}

export function hintPattern(text: string, revealed: number): string {
  let shown = 0
  return [...text]
    .map((ch) => {
      if (!LETTER.test(ch)) return ch
      return shown++ < revealed ? ch : "_"
    })
    .join(" ")
}

export function pointsFor(votes: number, hints: number): number {
  return Math.round(votes * POINTS_PER_VOTE * (1 - HINT_PENALTY * hints))
}

export function revealLetter(state: GameState, answers: Array<BoardAnswer>, index: number): GameState {
  if (state.status !== "playing" || state.found.includes(index)) return state
  const used = hintsUsed(state, index)
  if (used >= maxHints(answers[index])) return state
  const hints = Array.from({ length: answers.length }, (_, i) => state.hints?.[i] ?? 0)
  hints[index] = used + 1
  return { ...state, hints }
}

export function revealClue(state: GameState, index: number): GameState {
  if (state.clues?.includes(index)) return state
  return { ...state, clues: [...(state.clues ?? []), index] }
}

export function applyGuess(
  state: GameState,
  answers: Array<BoardAnswer>,
  text: string,
): { state: GameState; outcome: GuessOutcome } {
  if (state.status !== "playing") return { state, outcome: { kind: "over" } }
  const cleaned = text.trim()
  if (!normalize(cleaned)) return { state, outcome: { kind: "empty" } }
  if (/\s/.test(cleaned)) return { state, outcome: { kind: "multi" } }

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
    .map((i) => ({ answer: answers[i], hints: hintsUsed(state, i) }))
    .sort((a, b) => a.answer.rank - b.answer.rank)
    .map(({ answer, hints }) => ({ label: answer.text, rank: answer.rank, hints, points: pointsFor(answer.votes, hints) }))
  const bonus = state.found.length === answers.length ? CLEAR_BONUS : 0
  const total = lines.reduce((sum, l) => sum + l.points, 0) + bonus
  return { lines, bonus, total }
}

export function maxScore(answers: Array<BoardAnswer>): number {
  return answers.reduce((sum, a) => sum + pointsFor(a.votes, 0), 0) + CLEAR_BONUS
}

export function shareText(opts: {
  label: string
  question: string
  state: GameState
  answers: Array<BoardAnswer>
  total: number
  url: string
}): string {
  const { label, question, state, answers, total, url } = opts
  const board = answers
    .map((_, i) => (!state.found.includes(i) ? "⬜" : hintsUsed(state, i) ? "🟨" : "🟩"))
    .join("")
  const guesses = state.guesses.map((g) => (g.result === "hit" ? "🟩" : "🟥")).join("")
  return [
    `Ptali jsme se 100 AI · ${label}`,
    question,
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
