import { normalize } from "./match.ts"
import type { BoardAnswer } from "./types.ts"

export const PEOPLE_MIN_PLAYERS = 3
export const PEOPLE_MIN_VOTES = 2
const SIZE = 8

export type PeopleAnswer = { text: string; share: number; answer: number | null }

export function peopleBoard(games: Array<{ found: Array<number>; misses: Array<string> }>, answers: Array<Pick<BoardAnswer, "text">>): Array<PeopleAnswer> {
  if (games.length === 0) return []
  const hits = answers.map((answer, i) => ({ text: answer.text, players: games.filter((g) => g.found.includes(i)).length, answer: i }))

  const groups = new Map<string, Map<string, number>>()
  for (const game of games) {
    const seen = new Set<string>()
    for (const miss of game.misses) {
      const key = normalize(miss)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const spellings = groups.get(key) ?? new Map<string, number>()
      const shown = miss.trim().toLocaleLowerCase("cs")
      spellings.set(shown, (spellings.get(shown) ?? 0) + 1)
      groups.set(key, spellings)
    }
  }
  const misses = [...groups.values()].map((spellings) => ({
    text: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
    players: [...spellings.values()].reduce((sum, n) => sum + n, 0),
    answer: null,
  }))

  return [...hits, ...misses.filter((m) => m.players >= PEOPLE_MIN_VOTES)]
    .filter((entry) => entry.players > 0)
    .sort((a, b) => b.players - a.players || (a.answer ?? SIZE) - (b.answer ?? SIZE))
    .slice(0, SIZE)
    .map(({ text, players, answer }) => ({ text, share: players / games.length, answer }))
}
