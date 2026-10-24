import "@tanstack/react-start/server-only"
import { AppwriteException, ID, Query, type Models } from "node-appwrite"
import { LAUNCH_DATE, isValidDate, pragueDate } from "@/lib/day"
import { progress, replay, scoreLines, type GameState } from "@/lib/game"
import { refKey, type GameRef } from "@/lib/game-ref"
import { normalize } from "@/lib/match"
import { guestName } from "@/lib/players"
import type { Result } from "@/lib/storage"
import type { BoardAnswer } from "@/lib/types"
import { DATABASE, appwrite } from "./appwrite"
import { loadCustom } from "./custom"
import { loadPuzzle } from "./puzzles"

const GAMES = "games"
const PLAYERS = "players"
const STATS_TTL_MS = 15_000

type GameRow = Models.Row & {
  userId: string
  key: string
  date: string | null
  board: string
  state: string
  status: GameState["status"]
  score: number
  found: Array<number>
  strikes: number
  misses: Array<string>
  onTime: boolean | null
  finishedAt: string | null
}
type PlayerRow = Models.Row & { name: string }

function db() {
  const remote = appwrite()
  if (!remote) throw new Error("Účty teď nejsou k dispozici.")
  return remote.tables
}

export function fingerprint(answers: Array<BoardAnswer>): string {
  return answers.map((a) => a.text).join("|")
}

async function boardOf(ref: GameRef): Promise<{ answers: Array<BoardAnswer>; date: string | null } | null> {
  if (ref.kind === "custom") {
    const game = await loadCustom(ref.id)
    return game ? { answers: game.answers, date: null } : null
  }
  if (!isValidDate(ref.id) || ref.id < LAUNCH_DATE || ref.id > pragueDate()) return null
  const puzzle = await loadPuzzle(ref.id)
  return puzzle ? { answers: puzzle.answers, date: ref.id } : null
}

async function findGame(userId: string, key: string): Promise<GameRow | null> {
  const { rows } = await db().listRows<GameRow>({ databaseId: DATABASE, tableId: GAMES, queries: [Query.equal("userId", userId), Query.equal("key", key), Query.limit(1)] })
  return rows[0] ?? null
}

export async function loadGame(userId: string, ref: GameRef): Promise<{ state: GameState; board: string } | null> {
  const row = await findGame(userId, refKey(ref))
  return row ? { state: JSON.parse(row.state) as GameState, board: row.board } : null
}

export async function saveGame(userId: string, ref: GameRef, board: string, claimed: GameState, claimedDaily: boolean): Promise<GameState | null> {
  const target = await boardOf(ref)
  if (!target || fingerprint(target.answers) !== board) return null

  const key = refKey(ref)
  const state = replay(target.answers, claimed)
  const existing = await findGame(userId, key)
  if (existing && existing.board === board) {
    const saved = JSON.parse(existing.state) as GameState
    if (existing.status !== "playing" || progress(saved) >= progress(state)) return saved
  }

  const finished = state.status !== "playing"
  const data = {
    userId,
    key,
    date: target.date,
    board,
    state: JSON.stringify(state),
    status: state.status,
    score: scoreLines(state, target.answers).total,
    found: state.found,
    strikes: state.strikes,
    misses: state.guesses.filter((g) => g.result === "miss").map((g) => g.text.slice(0, 40)),
    onTime: finished && target.date !== null && (target.date === pragueDate() || (!existing && claimedDaily)),
    finishedAt: finished ? new Date().toISOString() : null,
  }

  const tables = db()
  if (existing) {
    await tables.updateRow({ databaseId: DATABASE, tableId: GAMES, rowId: existing.$id, data })
    return state
  }
  try {
    await tables.createRow({ databaseId: DATABASE, tableId: GAMES, rowId: ID.unique(), data })
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 409)) throw error
    const raced = await findGame(userId, key)
    if (raced) await tables.updateRow({ databaseId: DATABASE, tableId: GAMES, rowId: raced.$id, data })
  }
  return state
}

export async function listResults(userId: string): Promise<Record<string, Result>> {
  const { rows } = await db().listRows<GameRow>({
    databaseId: DATABASE,
    tableId: GAMES,
    queries: [Query.equal("userId", userId), Query.notEqual("status", "playing"), Query.isNotNull("date"), Query.select(["date", "score", "found", "strikes", "status", "onTime"]), Query.limit(5000)],
  })
  return Object.fromEntries(
    rows.map((r) => [r.date!, { score: r.score, found: r.found.length, strikes: r.strikes, cleared: r.status === "won", daily: r.onTime === true }]),
  )
}

export async function moveGames(fromUserId: string, toUserId: string): Promise<number> {
  const tables = db()
  const list = (userId: string) =>
    tables.listRows<GameRow>({ databaseId: DATABASE, tableId: GAMES, queries: [Query.equal("userId", userId), Query.select(["$id", "key"]), Query.limit(5000)] })
  const [from, to] = await Promise.all([list(fromUserId), list(toUserId)])
  const taken = new Set(to.rows.map((r) => r.key))
  const moving = from.rows.filter((r) => !taken.has(r.key))
  await Promise.all(moving.map((r) => tables.updateRow({ databaseId: DATABASE, tableId: GAMES, rowId: r.$id, data: { userId: toUserId } })))
  return moving.length
}

export async function setPlayerName(userId: string, name: string): Promise<void> {
  await db().upsertRow({ databaseId: DATABASE, tableId: PLAYERS, rowId: userId, data: { name } })
}

async function namesOf(userIds: Array<string>): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { rows } = await db().listRows<PlayerRow>({ databaseId: DATABASE, tableId: PLAYERS, queries: [Query.equal("$id", userIds), Query.limit(userIds.length)] })
  return new Map(rows.map((r) => [r.$id, r.name]))
}

type Finished = Pick<GameRow, "userId" | "score" | "found" | "status" | "finishedAt">
const finishedCache = new Map<string, { at: number; rows: Array<Finished> }>()

async function finishedGames(key: string, include: string | null): Promise<Array<Finished>> {
  const cached = finishedCache.get(key)
  const fresh = cached && Date.now() - cached.at < STATS_TTL_MS && (!include || cached.rows.some((r) => r.userId === include))
  if (fresh) return cached.rows
  const { rows } = await db().listRows<GameRow>({
    databaseId: DATABASE,
    tableId: GAMES,
    queries: [Query.equal("key", key), Query.notEqual("status", "playing"), Query.select(["userId", "score", "found", "status", "finishedAt"]), Query.limit(5000)],
  })
  finishedCache.set(key, { at: Date.now(), rows })
  return rows
}

export type DayStats = {
  players: number
  average: number
  cleared: number
  foundShare: Array<number>
  leaders: Array<{ rank: number; name: string; score: number; me: boolean }>
  me: { rank: number; score: number; betterThan: number; tied: number } | null
}

export async function dayStats(ref: GameRef, answerCount: number, userId: string | null): Promise<DayStats> {
  const rows = [...(await finishedGames(refKey(ref), userId))].sort((a, b) => b.score - a.score || (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""))
  const players = rows.length
  const rankOf = (score: number) => 1 + rows.filter((r) => r.score > score).length
  const top = rows.slice(0, 10)
  const names = await namesOf(top.map((r) => r.userId))
  const mine = userId ? rows.find((r) => r.userId === userId) : undefined

  return {
    players,
    average: players ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / players) : 0,
    cleared: players ? rows.filter((r) => r.status === "won").length / players : 0,
    foundShare: Array.from({ length: answerCount }, (_, i) => (players ? rows.filter((r) => r.found.includes(i)).length / players : 0)),
    leaders: top.map((r) => ({ rank: rankOf(r.score), name: names.get(r.userId) ?? guestName(r.userId), score: r.score, me: r.userId === userId })),
    me: mine
      ? {
          rank: rankOf(mine.score),
          score: mine.score,
          betterThan: players > 1 ? rows.filter((r) => r.score < mine.score).length / (players - 1) : 0,
          tied: rows.filter((r) => r.score === mine.score && r.userId !== mine.userId).length,
        }
      : null,
  }
}

export async function missedGuesses(ref: GameRef): Promise<{ players: number; misses: Array<{ text: string; count: number }> }> {
  const { rows } = await db().listRows<GameRow>({
    databaseId: DATABASE,
    tableId: GAMES,
    queries: [Query.equal("key", refKey(ref)), Query.select(["misses"]), Query.limit(5000)],
  })
  const groups = new Map<string, Map<string, number>>()
  for (const text of rows.flatMap((r) => r.misses)) {
    const spellings = groups.get(normalize(text)) ?? new Map<string, number>()
    const shown = text.toLocaleLowerCase("cs")
    spellings.set(shown, (spellings.get(shown) ?? 0) + 1)
    groups.set(normalize(text), spellings)
  }
  const misses = [...groups.values()]
    .map((spellings) => {
      const [text] = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0]
      return { text, count: [...spellings.values()].reduce((a, b) => a + b, 0) }
    })
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "cs"))
  return { players: rows.length, misses }
}
