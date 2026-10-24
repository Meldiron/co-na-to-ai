import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import type { OpenRouter } from "@openrouter/sdk"
import type { Model } from "@openrouter/sdk/models"
import { addDays, isValidDate, pragueDate, puzzleNumber } from "../src/lib/day.ts"
import type { Puzzle, Question } from "../src/lib/types.ts"
import { askAll, type RawResponse } from "./ask.ts"
import { buildPuzzle, type gate, type group } from "./build.ts"
import { JUDGE_MODEL, type judge } from "./cluster.ts"
import { finalize } from "./finalize.ts"
import { resolveAliases, writeAliases } from "./aliases.ts"
import { PATHS, loadCast, loadEnv, loadQuestionFiles, puzzlePath, readJson, saveQuestionFile, writeJson, type QuestionFile } from "./lib/io.ts"
import { catalogue, client } from "./lib/openrouter.ts"
import { SPARES } from "./lib/roster.ts"

const MAX_REPLACEMENTS = 2

type Run = {
  date: string
  question: Question
  startedAt: string
  durationMs: number
  costUsd: number
  responses: Array<RawResponse>
  judgement?: Awaited<ReturnType<typeof judge>>["judgement"]
  gate?: ReturnType<typeof gate>
}

function runFile(date: string, questionId: string) {
  return join(PATHS.runs, `${date}--${questionId}.json`)
}

function findScheduled(files: Array<QuestionFile>, date: string) {
  for (const file of files) {
    const question = file.questions.find((q) => q.date === date && (q.status === "approved" || q.status === "used"))
    if (question) return { file, question }
  }
  return null
}

function takeReserve(files: Array<QuestionFile>, date: string) {
  for (const file of files.filter((f) => f.path.includes("reserve"))) {
    const question = file.questions.find((q) => !q.date && q.status === "approved")
    if (question) {
      question.date = date
      return { file, question }
    }
  }
  return null
}

async function fanOut(sdk: OpenRouter, models: Map<string, Model>, question: Question, date: string): Promise<Run> {
  const cast = await loadCast()
  const started = Date.now()
  const responses = await askAll({
    sdk,
    catalogue: models,
    answerers: cast.answerers,
    personas: cast.personas,
    spares: SPARES.filter((s) => !cast.answerers.some((a) => a.model === s)),
    question: question.text,
    onProgress: (done, total) => {
      if (done % 10 === 0 || done === total) process.stdout.write(`  ${done}/${total} answered\n`)
    },
  })
  const costUsd = responses.flatMap((r) => r.attempts).reduce((sum, a) => sum + a.costUsd, 0)
  return { date, question, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, costUsd, responses }
}

async function judgeAndPublish(sdk: OpenRouter, run: Run, file: QuestionFile): Promise<boolean> {
  const result = await finalize(sdk, run.question.text, run.responses)
  const { grouped } = result
  run.judgement = result.judgement
  run.costUsd += result.costUsd
  run.gate = result.gate
  await writeJson(runFile(run.date, run.question.id), run)

  report(run, grouped)
  if (!run.gate.passed) {
    run.question.status = "rejected"
    await saveQuestionFile(file)
    return false
  }

  const puzzle = buildPuzzle({
    date: run.date,
    number: puzzleNumber(run.date),
    questionId: run.question.id,
    question: run.question.text,
    responses: run.responses,
    grouped,
    judgeModel: JUDGE_MODEL,
    costUsd: run.costUsd,
    durationMs: run.durationMs,
  })
  await writeJson(puzzlePath(run.date), puzzle)
  run.question.status = "used"
  await saveQuestionFile(file)
  return true
}

function report(run: Run, grouped: ReturnType<typeof group>) {
  const g = run.gate!
  console.log(`\n${run.date} · ${run.question.text}`)
  grouped.slice(0, 8).forEach((c, i) => console.log(`  ${i + 1}. ${c.canonical.padEnd(24)} ${c.answerers.length}`))
  console.log(`  answered ${g.answered}/${run.responses.length} · clusters ${grouped.length} · top ${Math.round(g.topShare * 100)} % · board ${Math.round(g.boardShare * 100)} % · cost $${run.costUsd.toFixed(3)} · ${Math.round(run.durationMs / 1000)} s`)
  console.log(g.passed ? "  gate: passed" : `  gate: FAILED · ${g.flags.join(" · ")}`)
}

async function produce(sdk: OpenRouter, models: Map<string, Model>, date: string, force: boolean) {
  if (existsSync(puzzlePath(date)) && !force) {
    console.log(`${date}: puzzle exists, skipping`)
    return
  }
  const files = await loadQuestionFiles()
  let slot = findScheduled(files, date)
  for (let attempt = 0; attempt <= MAX_REPLACEMENTS; attempt++) {
    if (!slot) {
      console.log(`${date}: no approved question scheduled and no reserve left. Needs a human.`)
      return
    }
    const run = await fanOut(sdk, models, slot.question, date)
    if (await judgeAndPublish(sdk, run, slot.file)) return
    if (attempt === MAX_REPLACEMENTS) break
    slot = takeReserve(files, date)
    if (slot) {
      await saveQuestionFile(slot.file)
      console.log(`  trying reserve question "${slot.question.text}"`)
    }
  }
  console.log(`${date}: every candidate failed the gate. Needs a human.`)
}

async function recluster(sdk: OpenRouter, date: string) {
  const files = await loadQuestionFiles()
  const slot = findScheduled(files, date)
  if (!slot) throw new Error(`No question scheduled for ${date}`)
  const path = runFile(date, slot.question.id)
  if (!existsSync(path)) throw new Error(`No saved run at ${path}`)
  const run = await readJson<Run>(path)
  run.question = slot.question
  await judgeAndPublish(sdk, run, slot.file)
}

async function rejudge(sdk: OpenRouter, path: string) {
  const puzzle = await readJson<Puzzle & { gate?: unknown }>(path)
  const responses: Array<RawResponse> = puzzle.responses.map((r) => ({
    answerer: r.answerer,
    persona: r.persona,
    model: r.raw ? r.model : null,
    raw: r.raw || null,
    attempts: [],
  }))
  const result = await finalize(sdk, puzzle.question, responses, { aliasesOnFail: true })
  const rebuilt = buildPuzzle({
    date: puzzle.date,
    number: path.includes(`${PATHS.puzzles}/`) ? puzzleNumber(puzzle.date) : puzzle.number,
    questionId: puzzle.questionId,
    question: puzzle.question,
    responses,
    grouped: result.grouped,
    judgeModel: JUDGE_MODEL,
    costUsd: puzzle.meta.costUsd + result.costUsd,
    durationMs: puzzle.meta.durationMs,
  })
  rebuilt.responses = puzzle.responses.map((r) => ({ ...r, answer: rebuilt.responses.find((x) => x.answerer === r.answerer)?.answer ?? null }))
  await writeJson(path, { ...puzzle, ...rebuilt, ...(puzzle.gate ? { gate: result.gate } : {}) })
  console.log(`${path}: ${puzzle.question}`)
  rebuilt.answers.forEach((a) => console.log(`  ${a.rank}. ${a.text.padEnd(18)} ${String(a.votes).padStart(3)}  ${a.aliases.length} aliases`))
  console.log(`  gate ${result.gate.passed ? "passed" : `FAILED · ${result.gate.flags.join(" · ")}`} · +$${result.costUsd.toFixed(3)}`)
}

async function refreshAliases(sdk: OpenRouter, path: string) {
  const puzzle = await readJson<Puzzle>(path)
  const rawOf = new Map(puzzle.responses.map((r) => [r.answerer, r.raw]))
  const outside = puzzle.others.map((o) => o.text)
  const { answers, costUsd } = await writeAliases(
    sdk,
    puzzle.question,
    puzzle.answers.map((a) => ({ canonical: a.text, examples: a.answerers.map((id) => rawOf.get(id) ?? "") })),
    outside,
  )
  const merged = resolveAliases(
    puzzle.answers.map((a) => a.text),
    puzzle.answers.map((a) => ({ canonical: a.text, accept: [...a.aliases, ...(answers.find((x) => x.canonical === a.text)?.accept ?? [])] })),
    outside,
  )
  for (const a of puzzle.answers) a.aliases = merged.get(a.text) ?? []
  puzzle.meta.costUsd = Math.round((puzzle.meta.costUsd + costUsd) * 10_000) / 10_000
  await writeJson(path, puzzle)
  console.log(`${path}: ${puzzle.answers.map((a) => `${a.text} ${a.aliases.length}`).join(" · ")} · +$${costUsd.toFixed(3)}`)
}

async function main() {
  loadEnv()
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing. Put OPENROUTER_API_KEY=sk-or-... into .env or the environment.")
    process.exit(1)
  }
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      days: { type: "string", default: "7" },
      from: { type: "string" },
      force: { type: "boolean", default: false },
      recluster: { type: "string" },
      rejudge: { type: "string", multiple: true },
      aliases: { type: "string", multiple: true },
    },
  })
  const sdk = client()

  if (values.aliases) {
    for (const path of values.aliases) await refreshAliases(sdk, resolve(path))
    return
  }

  if (values.rejudge) {
    for (const path of values.rejudge) await rejudge(sdk, resolve(path))
    return
  }

  if (values.recluster) {
    await recluster(sdk, values.recluster)
    return
  }

  const models = await catalogue()
  const dates = values.date
    ? [values.date]
    : Array.from({ length: Number(values.days) }, (_, i) => addDays(values.from ?? pragueDate(), i))
  for (const date of dates) {
    if (!isValidDate(date)) throw new Error(`Invalid date ${date}`)
    await produce(sdk, models, date, values.force)
  }
}

await main()
