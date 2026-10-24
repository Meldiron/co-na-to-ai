import "@tanstack/react-start/server-only"
import { AppwriteException, Query, type Models } from "node-appwrite"
import { encodeSecret } from "@/lib/secret"
import type { Puzzle, PuzzlePayload, PuzzleSummary } from "@/lib/types"
import { DATABASE, appwrite } from "./appwrite"

const TABLE = process.env.DAILY_TABLE ?? "puzzles"

type DailyRow = Models.Row & { date: string; number: number; question: string; passed: boolean; puzzle: string | null }

const files = import.meta.glob<Puzzle>("../../puzzles/*.json", { import: "default" })

const bundled = new Map(
  Object.entries(files).map(([path, load]) => [path.slice(path.lastIndexOf("/") + 1, -".json".length), load]),
)

export async function loadPuzzle(date: string): Promise<Puzzle | null> {
  const load = bundled.get(date)
  if (load) return load()
  const remote = appwrite()
  if (!remote) return null
  try {
    const row = await remote.tables.getRow<DailyRow>({ databaseId: DATABASE, tableId: TABLE, rowId: date })
    return row.passed && row.puzzle ? (JSON.parse(row.puzzle) as Puzzle) : null
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 404)) console.error(`Could not load the puzzle for ${date}:`, error)
    return null
  }
}

async function remoteSummaries(today: string): Promise<Array<PuzzleSummary>> {
  const remote = appwrite()
  if (!remote) return []
  try {
    const { rows } = await remote.tables.listRows<DailyRow>({
      databaseId: DATABASE,
      tableId: TABLE,
      queries: [Query.equal("passed", true), Query.lessThanEqual("date", today), Query.select(["date", "number", "question"]), Query.limit(5000)],
    })
    return rows.map((r) => ({ date: r.date, number: r.number, question: r.question }))
  } catch (error) {
    console.error("Could not list daily puzzles:", error)
    return []
  }
}

export function toPayload(puzzle: Puzzle, kind: PuzzlePayload["kind"] = "daily", id = puzzle.date): PuzzlePayload {
  const { answers, others, responses, ...rest } = puzzle
  return { ...rest, kind, id, secret: encodeSecret({ answers, others, responses }, id) }
}

export async function recentSummaries(today: string, exclude: string, count = 3): Promise<Array<PuzzleSummary>> {
  return (await summaries(today)).filter((s) => s.date !== exclude && s.date !== today).slice(0, count)
}

export async function summaries(today: string): Promise<Array<PuzzleSummary>> {
  const local = await Promise.all([...bundled].filter(([date]) => date <= today).map(([, load]) => load()))
  const byDate = new Map((await remoteSummaries(today)).map((s) => [s.date, s]))
  for (const p of local) byDate.set(p.date, { date: p.date, number: p.number, question: p.question })
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}
