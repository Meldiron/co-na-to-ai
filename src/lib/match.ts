import damerauLevenshtein from "damerau-levenshtein"
import type { BoardAnswer } from "./types.ts"

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

export function looseKey(text: string): string {
  return normalize(text).replaceAll("y", "i").replaceAll("w", "v").replace(/(\p{L})\1+/gu, "$1")
}

export function allowedTypos(length: number): number {
  if (length <= 3) return 0
  if (length <= 6) return 1
  return 2
}

function typoDistance(a: string, b: string): number {
  const limit = Math.min(allowedTypos(a.length), allowedTypos(b.length))
  if (limit === 0) return Infinity
  const { steps } = damerauLevenshtein(a, b)
  return steps <= limit ? steps : Infinity
}

export type MatchResult =
  | { kind: "hit"; index: number }
  | { kind: "repeat"; index: number }
  | { kind: "miss" }

export function matchGuess(
  guess: string,
  answers: Array<Pick<BoardAnswer, "text" | "aliases">>,
  found: ReadonlySet<number>,
): MatchResult {
  const g = looseKey(guess)
  if (!g) return { kind: "miss" }
  const compact = g.replaceAll(" ", "")

  let best = { index: -1, distance: Infinity }
  for (const [index, answer] of answers.entries()) {
    for (const form of [answer.text, ...answer.aliases]) {
      const f = looseKey(form)
      if (!f) continue
      const distance = f === g || f.replaceAll(" ", "") === compact ? 0 : typoDistance(g, f)
      if (distance < best.distance) best = { index, distance }
    }
  }

  if (best.index === -1) return { kind: "miss" }
  return found.has(best.index) ? { kind: "repeat", index: best.index } : { kind: "hit", index: best.index }
}
