import "@tanstack/react-start/server-only"
import { encodeSecret } from "@/lib/secret"
import type { Puzzle, PuzzlePayload, PuzzleSummary } from "@/lib/types"

const files = import.meta.glob<Puzzle>("../../puzzles/*.json", { import: "default" })

const byDate = new Map(
  Object.entries(files).map(([path, load]) => [path.slice(path.lastIndexOf("/") + 1, -".json".length), load]),
)

export async function loadPuzzle(date: string): Promise<Puzzle | null> {
  const load = byDate.get(date)
  return load ? load() : null
}

export function publishedDates(today: string): Array<string> {
  return [...byDate.keys()].filter((date) => date <= today).sort()
}

export function toPayload(puzzle: Puzzle): PuzzlePayload {
  const { answers, others, responses, ...rest } = puzzle
  return { ...rest, secret: encodeSecret({ answers, others, responses }, puzzle.date) }
}

export async function summaries(today: string): Promise<Array<PuzzleSummary>> {
  const dates = publishedDates(today).reverse()
  const puzzles = await Promise.all(dates.map(loadPuzzle))
  return puzzles
    .filter((p): p is Puzzle => p !== null)
    .map((p) => ({ date: p.date, number: p.number, question: p.question }))
}
