import { AppwriteException, Client, ID, Query, TablesDB, type Models } from "node-appwrite"
import { BANK_TABLE, type BankRow, asQuestion } from "../../../pipeline/bank.ts"
import { type Attempt, pickQuestion, targetDates } from "../../../pipeline/daily.ts"
import { generatePuzzle } from "../../../pipeline/generate.ts"
import { catalogue, client } from "../../../pipeline/lib/openrouter.ts"
import { finaleVerdict, probe, verdict } from "../../../pipeline/probe.ts"
import { addDays, pragueDate, puzzleNumber } from "../../../src/lib/day.ts"
import { FINALE_SLOTS, finaleNumber, weekOf } from "../../../src/lib/finale.ts"
import type { Question } from "../../../src/lib/types.ts"

type Context = {
  req: { headers: Record<string, string> }
  res: { json: (body: unknown, status?: number) => unknown }
  log: (message: string) => void
  error: (message: string) => void
}

const DATABASE = process.env.DAILY_DATABASE ?? "ai100"
const TABLE = process.env.DAILY_TABLE ?? "puzzles"
const FINALE_TABLE = "finales"
const BUDGET_MS = 8 * 60_000
const FINALE_MAX_FAILURES = 8
const FINALE_MIN_ANSWERED = 70
const FINALE_MIN_ANSWERS = 5

type AttemptRow = Models.Row & Attempt
type FinaleRow = Models.Row & { week: string; slot: number; questionId: string; passed: boolean }

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
  const [{ rows }, bank, finales] = await Promise.all([
    db.listRows<AttemptRow>({ databaseId: DATABASE, tableId: TABLE, queries: [Query.select(["date", "questionId", "passed"]), Query.limit(5000)] }),
    db.listRows<BankRow>({ databaseId: DATABASE, tableId: BANK_TABLE, queries: [Query.equal("status", ["approved", "candidate"]), Query.orderAsc("$createdAt"), Query.limit(5000)] }),
    db.listRows<FinaleRow>({ databaseId: DATABASE, tableId: FINALE_TABLE, queries: [Query.select(["week", "slot", "questionId", "passed"]), Query.limit(5000)] }),
  ])
  const attempts: Array<Attempt> = rows.map((r) => ({ date: r.date, questionId: r.questionId, passed: r.passed }))
  const fromBank = new Set(bank.rows.map((r) => r.$id))
  const reserves = [
    ...bundledReserves,
    ...bank.rows.filter((r) => r.status === "approved").map(asQuestion),
    ...bank.rows.filter((r) => r.status === "candidate").map(asQuestion),
  ]
  const finaleRows: Array<Pick<FinaleRow, "week" | "slot" | "questionId" | "passed">> = finales.rows.map((r) => ({ week: r.week, slot: r.slot, questionId: r.questionId, passed: r.passed }))
  const finaleReserves = [
    ...bank.rows.filter((r) => r.status === "approved").map(asQuestion),
    ...bank.rows.filter((r) => r.status === "candidate").reverse().map(asQuestion),
    ...[...bundledReserves].reverse(),
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

  const recordFinale = async (week: string, slot: number, question: Question, passed: boolean, data: { board: unknown; answered: number | null; costUsd: number; note: string | null }) => {
    finaleRows.push({ week, slot, questionId: question.id, passed })
    try {
      await db.createRow({
        databaseId: DATABASE,
        tableId: FINALE_TABLE,
        rowId: passed ? `${week}-${slot}` : ID.unique(),
        data: { week, slot, questionId: question.id, question: question.text, passed, board: passed ? JSON.stringify(data.board) : null, answered: data.answered, costUsd: data.costUsd, note: data.note },
      })
    } catch (e) {
      if (!(e instanceof AppwriteException && e.code === 409)) throw e
      log(`finále ${week}/${slot}: another run saved this slot first`)
    }
    if (fromBank.has(question.id)) {
      await db.updateRow({ databaseId: DATABASE, tableId: BANK_TABLE, rowId: question.id, data: { status: passed ? "used" : "rejected", usedOn: week, note: passed ? "Finále" : data.note } })
    }
  }

  for (const date of targetDates(pragueDate())) {
    while (!ready.has(date)) {
      if (Date.now() - started > BUDGET_MS) {
        log(`${date}: out of time, the next run continues`)
        missing.push(date)
        break
      }
      const inFinale = new Set(finaleRows.map((r) => r.questionId))
      const question = pickQuestion(questions, reserves.filter((q) => !inFinale.has(q.id)), attempts, date)
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

  const today = pragueDate()
  finale: for (const week of [weekOf(today), addDays(weekOf(today), 7)]) {
    for (let slot = 0; slot < FINALE_SLOTS; slot++) {
      while (!finaleRows.some((r) => r.week === week && r.slot === slot && r.passed)) {
        if (finaleRows.filter((r) => r.week === week && !r.passed).length >= FINALE_MAX_FAILURES) {
          error(`finále ${week}: too many failed questions, needs a human`)
          missing.push(`finále ${week}`)
          continue finale
        }
        if (Date.now() - started > BUDGET_MS) {
          log(`finále ${week}: out of time, the next run continues`)
          missing.push(`finále ${week}`)
          break finale
        }
        const used = new Set([...attempts.map((a) => a.questionId), ...finaleRows.map((r) => r.questionId)])
        const question = finaleReserves.find((q) => !used.has(q.id))
        if (!question) {
          error(`finále ${week}: no question left to try, needs a human`)
          missing.push(`finále ${week}`)
          break finale
        }

        setup ??= { sdk: client(), models: await catalogue() }
        const check = await probe(question.text, setup)
        const reason = finaleVerdict(check)
        if (reason) {
          await recordFinale(week, slot, question, false, { board: null, answered: null, costUsd: check.costUsd, note: `Zkouška: ${reason}` })
          log(`finále ${week}/${slot}: skipped "${question.text}" · ${reason}`)
          continue
        }

        log(`finále ${week}/${slot}: asking "${question.text}"`)
        const { puzzle } = await generatePuzzle({ date: week, number: finaleNumber(week), questionId: question.id, question: question.text })
        const passed = puzzle.answered >= FINALE_MIN_ANSWERED && puzzle.answers.length >= FINALE_MIN_ANSWERS
        const board = { answered: puzzle.answered, answers: puzzle.answers.map(({ rank, text, votes, aliases }) => ({ rank, text, votes, aliases })) }
        const costUsd = puzzle.meta.costUsd + check.costUsd
        await recordFinale(week, slot, question, passed, { board, answered: puzzle.answered, costUsd, note: passed ? null : `Odpovědělo ${puzzle.answered}, odpovědí ${puzzle.answers.length}` })
        log(passed ? `finále ${week}/${slot}: saved · ${puzzle.answers.map((a) => `${a.text} ${a.votes}`).join(", ")} · $${costUsd.toFixed(2)}` : `finále ${week}/${slot}: board too thin`)
        if (passed) generated.push(`finále ${week}/${slot}`)
      }
    }
  }

  return res.json({ ok: missing.length === 0, generated, missing })
}
