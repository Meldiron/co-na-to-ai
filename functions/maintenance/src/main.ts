import { Client, ID, Query, TablesDB, Users, type Models } from "node-appwrite"
import { z } from "zod"
import { BANK_TABLE, DRAFT_COUNT, POOL_TARGET, type BankRow, draftQuestions } from "../../../pipeline/bank.ts"
import { catalogue, client } from "../../../pipeline/lib/openrouter.ts"
import { probe, verdict, type Probe } from "../../../pipeline/probe.ts"
import type { Question } from "../../../src/lib/types.ts"

type Context = {
  req: { bodyText: string; headers: Record<string, string> }
  res: { json: (body: unknown, status?: number) => unknown }
  log: (message: string) => void
  error: (message: string) => void
}

const DATABASE = process.env.DAILY_DATABASE ?? "ai100"
const GUEST_DAYS = 30
const PROBES_AT_ONCE = 4
const BUDGET_MS = 11 * 60_000

const Body = z.object({
  task: z.enum(["all", "questions", "cleanup"]).default("all"),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  olderThanDays: z.number().int().min(0).default(GUEST_DAYS),
})

type PuzzleRow = Models.Row & { questionId: string; question: string; passed: boolean; gate: string | null }

const questionFiles = Object.entries(import.meta.glob<Array<Question>>("../../../questions/*.json", { eager: true, import: "default" }))
const bundledQuestions = questionFiles.flatMap(([, list]) => list)
const bundledReserves = questionFiles.filter(([path]) => path.includes("reserve")).flatMap(([, list]) => list)

const percent = (share: number) => `${Math.round(share * 100)} %`

function reasonOf(gate: string | null): string {
  if (!gate) return "failed the quality gate"
  const parsed = JSON.parse(gate) as { flags?: Array<string>; probe?: Probe }
  if (parsed.flags?.length) return parsed.flags.join("; ")
  if (parsed.probe) return `top answer "${parsed.probe.top}" had ${percent(parsed.probe.share)} in a ${parsed.probe.answered}-answer probe`
  return "failed the quality gate"
}

async function refill(db: TablesDB, force: boolean, started: number, log: Context["log"]) {
  const [bank, puzzles] = await Promise.all([
    db.listRows<BankRow>({ databaseId: DATABASE, tableId: BANK_TABLE, queries: [Query.select(["$id", "text", "status"]), Query.limit(5000)] }),
    db.listRows<PuzzleRow>({
      databaseId: DATABASE,
      tableId: "puzzles",
      queries: [Query.select(["questionId", "question", "passed", "gate"]), Query.orderDesc("$createdAt"), Query.limit(5000)],
    }),
  ])
  const tried = new Set(puzzles.rows.map((r) => r.questionId))
  const unusedBundled = bundledReserves.filter((q) => q.status === "approved" && !q.date && !tried.has(q.id)).length
  const waiting = bank.rows.filter((r) => r.status === "approved" || r.status === "candidate").length
  const pool = unusedBundled + waiting
  if (pool >= POOL_TARGET && !force) {
    log(`questions: ${pool} waiting (${unusedBundled} bundled, ${waiting} drafted), nothing to add`)
    return { pool, drafted: 0, added: 0, costUsd: 0 }
  }

  const sdk = client()
  const models = await catalogue()
  const { questions: drafts, costUsd: draftCost } = await draftQuestions(sdk, {
    count: DRAFT_COUNT,
    existing: [...bundledQuestions.map((q) => q.text), ...bank.rows.map((r) => r.text)],
    passed: puzzles.rows.filter((r) => r.passed).slice(0, 25).map((r) => r.question),
    failed: puzzles.rows
      .filter((r) => !r.passed)
      .slice(0, 25)
      .map((r) => ({ text: r.question, reason: reasonOf(r.gate) })),
  })
  log(`questions: ${pool} waiting, drafted ${drafts.length} new · $${draftCost.toFixed(3)}`)

  let added = 0
  let costUsd = draftCost
  for (let i = 0; i < drafts.length; i += PROBES_AT_ONCE) {
    if (Date.now() - started > BUDGET_MS) {
      log(`questions: out of time, ${drafts.length - i} drafts not probed`)
      break
    }
    await Promise.all(
      drafts.slice(i, i + PROBES_AT_ONCE).map(async (text) => {
        const check = await probe(text, { sdk, models })
        const problem = verdict(check)
        const bad = problem !== null
        costUsd += check.costUsd
        await db.createRow({
          databaseId: DATABASE,
          tableId: BANK_TABLE,
          rowId: ID.unique(),
          data: {
            text,
            status: bad ? "rejected" : "candidate",
            source: "generated",
            probe: JSON.stringify(check),
            probeShare: check.share,
            note: problem ? `Zkouška: ${problem}` : null,
          },
        })
        if (!bad) added++
        log(`  ${bad ? "rejected" : "candidate"} · ${text} · ${check.top} ${percent(check.share)} of ${check.answered}, ${check.distinct} different`)
      }),
    )
  }
  return { pool, drafted: drafts.length, added, costUsd: Math.round(costUsd * 1000) / 1000 }
}

async function cleanup(users: Users, db: TablesDB, days: number, dryRun: boolean, log: Context["log"]) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const removed: Array<string> = []
  let checked = 0
  let cursor: string | null = null
  for (;;) {
    const page: Models.UserList<Models.Preferences> = await users.list({ queries: [Query.lessThan("registration", cutoff), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] })
    for (const user of page.users) {
      checked++
      if (user.email || user.phone) continue
      const { total } = await db.listRows({ databaseId: DATABASE, tableId: "games", queries: [Query.equal("userId", user.$id), Query.select(["$id"]), Query.limit(1)] })
      if (total > 0) continue
      removed.push(user.$id)
      if (dryRun) continue
      await db.deleteRow({ databaseId: DATABASE, tableId: "players", rowId: user.$id }).catch(() => undefined)
      await users.delete({ userId: user.$id })
    }
    if (page.users.length < 100) break
    cursor = page.users[page.users.length - 1].$id
  }
  log(`guests: checked ${checked} users older than ${days} days, ${dryRun ? "would remove" : "removed"} ${removed.length} guests without games`)
  return { checked, removed: removed.length, ids: dryRun ? removed : [], dryRun }
}

export default async ({ req, res, log, error }: Context) => {
  const started = Date.now()
  const parsed = Body.safeParse(req.bodyText ? JSON.parse(req.bodyText) : {})
  if (!parsed.success) return res.json({ ok: false, error: parsed.error.issues[0]?.message }, 400)
  const { task, force, dryRun, olderThanDays } = parsed.data

  const sdk = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
    .setKey(req.headers["x-appwrite-key"] ?? "")
  const db = new TablesDB(sdk)
  const result: Record<string, unknown> = {}

  try {
    if (task === "all" || task === "cleanup") result.guests = await cleanup(new Users(sdk), db, olderThanDays, dryRun, log)
    if (task === "all" || task === "questions") result.questions = await refill(db, force, started, log)
    return res.json({ ok: true, ...result })
  } catch (e) {
    error(e instanceof Error ? (e.stack ?? e.message) : String(e))
    return res.json({ ok: false, ...result }, 500)
  }
}
