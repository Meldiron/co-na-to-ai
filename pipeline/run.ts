import { existsSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import type { OpenRouter } from "@openrouter/sdk"
import type { Model } from "@openrouter/sdk/models"
import { addDays, isValidDate, pragueDate, puzzleNumber } from "../src/lib/day.ts"
import type { Question } from "../src/lib/types.ts"
import { askAll, type RawResponse } from "./ask.ts"
import { buildPuzzle, gate, group } from "./build.ts"
import { JUDGE_MODEL, judge } from "./cluster.ts"
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
  const answered = run.responses.filter((r) => r.raw !== null)
  const { judgement, costUsd } = await judge(sdk, run.question.text, answered.map((r) => r.raw!))
  run.judgement = judgement
  run.costUsd += costUsd
  const grouped = group(run.responses, judgement)
  run.gate = gate(grouped, answered.length, judgement)
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
  console.log(`  answered ${g.answered}/${run.responses.length} · clusters ${grouped.length} · top ${Math.round(g.topShare * 100)} % · cost $${run.costUsd.toFixed(3)} · ${Math.round(run.durationMs / 1000)} s`)
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
    },
  })
  const sdk = client()

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
