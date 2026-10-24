import { AppwriteException, Client, ID, Query, TablesDB, type Models } from "node-appwrite"
import { BANK_TABLE, type BankRow, asQuestion } from "../../../pipeline/bank.ts"
import { type Attempt, pickQuestion, targetDates } from "../../../pipeline/daily.ts"
import { generatePuzzle } from "../../../pipeline/generate.ts"
import { catalogue, client } from "../../../pipeline/lib/openrouter.ts"
import { probe, verdict } from "../../../pipeline/probe.ts"
import { pragueDate, puzzleNumber } from "../../../src/lib/day.ts"
import type { Question } from "../../../src/lib/types.ts"

type Context = {
  req: { headers: Record<string, string> }
  res: { json: (body: unknown, status?: number) => unknown }
  log: (message: string) => void
  error: (message: string) => void
}

const DATABASE = process.env.DAILY_DATABASE ?? "ai100"
const TABLE = process.env.DAILY_TABLE ?? "puzzles"
const BUDGET_MS = 8 * 60_000

type AttemptRow = Models.Row & Attempt

const questionFiles = Object.entries(import.meta.glob<Array<Question>>("../../../questions/*.json", { eager: true, import: "default" }))
const questions = questionFiles.flatMap(([, list]) => list)
const bundledReserves = questionFiles.filter(([path]) => path.includes("reserve")).flatMap(([, list]) => list)
const bundled = new Set(Object.values(import.meta.glob<string>("../../../puzzles/*.json", { eager: true, import: "date" })))

export default async ({ req, res, log, error }: Context) => {
  const started = Date.now()
  const db = new TablesDB(
    new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
      .setKey(req.headers["x-appwrite-key"] ?? ""),
  )
  const [{ rows }, bank] = await Promise.all([
    db.listRows<AttemptRow>({ databaseId: DATABASE, tableId: TABLE, queries: [Query.select(["date", "questionId", "passed"]), Query.limit(5000)] }),
    db.listRows<BankRow>({ databaseId: DATABASE, tableId: BANK_TABLE, queries: [Query.equal("status", ["approved", "candidate"]), Query.orderAsc("$createdAt"), Query.limit(5000)] }),
  ])
  const attempts: Array<Attempt> = rows.map((r) => ({ date: r.date, questionId: r.questionId, passed: r.passed }))
  const fromBank = new Set(bank.rows.map((r) => r.$id))
  const reserves = [
    ...bundledReserves,
    ...bank.rows.filter((r) => r.status === "approved").map(asQuestion),
    ...bank.rows.filter((r) => r.status === "candidate").map(asQuestion),
  ]
  const ready = new Set([...bundled, ...attempts.filter((a) => a.passed).map((a) => a.date)])
  const generated: Array<string> = []
  const missing: Array<string> = []
  let setup: { sdk: ReturnType<typeof client>; models: Awaited<ReturnType<typeof catalogue>> } | null = null

  const record = async (date: string, question: Question, passed: boolean, data: { gate: unknown; costUsd: number; puzzle: unknown }) => {
    attempts.push({ date, questionId: question.id, passed })
    try {
      await db.createRow({
        databaseId: DATABASE,
        tableId: TABLE,
        rowId: passed ? date : ID.unique(),
        data: {
          date,
          questionId: question.id,
          question: question.text,
          number: puzzleNumber(date),
          passed,
          gate: JSON.stringify(data.gate),
          costUsd: data.costUsd,
          puzzle: passed ? JSON.stringify(data.puzzle) : null,
        },
      })
    } catch (e) {
      if (!(e instanceof AppwriteException && e.code === 409)) throw e
      log(`${date}: another run saved this day first`)
    }
    if (fromBank.has(question.id)) {
      await db.updateRow({ databaseId: DATABASE, tableId: BANK_TABLE, rowId: question.id, data: { status: passed ? "used" : "rejected", usedOn: date } })
    }
  }

  for (const date of targetDates(pragueDate())) {
    while (!ready.has(date)) {
      if (Date.now() - started > BUDGET_MS) {
        log(`${date}: out of time, the next run continues`)
        missing.push(date)
        break
      }
      const question = pickQuestion(questions, reserves, attempts, date)
      if (!question) {
        error(`${date}: no approved question left to try, needs a human`)
        missing.push(date)
        break
      }

      setup ??= { sdk: client(), models: await catalogue() }
      const check = await probe(question.text, setup)
      const top = `${check.top} ${Math.round(check.share * 100)} % of ${check.answered}`
      if (verdict(check)) {
        await record(date, question, false, { gate: { probe: check }, costUsd: check.costUsd, puzzle: null })
        log(`${date}: skipped "${question.text}" after the probe · ${top}`)
        continue
      }

      log(`${date}: asking "${question.text}" · probe ${top}`)
      const { puzzle, gate } = await generatePuzzle(
        { date, number: puzzleNumber(date), questionId: question.id, question: question.text },
        { onProgress: (done) => done % 25 === 0 && log(`  ${done} answered`) },
      )
      await record(date, question, gate.passed, { gate: { ...gate, probe: check }, costUsd: puzzle.meta.costUsd + check.costUsd, puzzle })

      const board = puzzle.answers.map((a) => `${a.text} ${a.votes}`).join(", ")
      log(gate.passed ? `${date}: saved · ${board} · $${puzzle.meta.costUsd}` : `${date}: failed the gate · ${gate.flags.join(" · ")}`)
      if (gate.passed) {
        ready.add(date)
        generated.push(date)
      }
    }
  }

  return res.json({ ok: missing.length === 0, generated, missing })
}
