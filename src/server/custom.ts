import "@tanstack/react-start/server-only"
import { randomBytes } from "node:crypto"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { askAll } from "../../pipeline/ask"
import { buildPuzzle, type GateResult } from "../../pipeline/build"
import { JUDGE_MODEL } from "../../pipeline/cluster"
import { finalize } from "../../pipeline/finalize"
import { catalogue, client } from "../../pipeline/lib/openrouter"
import { SPARES } from "../../pipeline/lib/roster"
import { answerers, personas } from "@/lib/cast"
import { pragueDate } from "@/lib/day"
import type { Puzzle } from "@/lib/types"

const DIR = process.env.CUSTOM_GAMES_DIR ?? join(process.cwd(), "custom")
const ID = /^[a-f0-9]{10}$/

export type CustomGame = Puzzle & { id: string; createdAt: string; gate: GateResult }

export type Job = {
  id: string
  question: string
  state: "asking" | "judging" | "done" | "failed"
  done: number
  total: number
  error?: string
}

const jobs = new Map<string, Job>()

export function startJob(question: string): Job {
  const id = randomBytes(5).toString("hex")
  const job: Job = { id, question, state: "asking", done: 0, total: answerers.length }
  jobs.set(id, job)
  run(job).catch((error: unknown) => {
    job.state = "failed"
    job.error = error instanceof Error ? error.message : String(error)
  })
  return job
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? null
}

async function run(job: Job) {
  const sdk = client()
  const models = await catalogue()
  const started = Date.now()
  const responses = await askAll({
    sdk,
    catalogue: models,
    answerers,
    personas: new Map(personas.map((p) => [p.id, p])),
    spares: SPARES,
    question: job.question,
    onProgress: (done) => {
      job.done = done
    },
  })
  job.state = "judging"
  const askCost = responses.flatMap((r) => r.attempts).reduce((sum, a) => sum + a.costUsd, 0)
  const { grouped, gate: verdict, costUsd } = await finalize(sdk, job.question, responses, { aliasesOnFail: true })
  const puzzle = buildPuzzle({
    date: pragueDate(),
    number: 0,
    questionId: job.id,
    question: job.question,
    responses,
    grouped,
    judgeModel: JUDGE_MODEL,
    costUsd: askCost + costUsd,
    durationMs: Date.now() - started,
  })
  const game: CustomGame = { ...puzzle, id: job.id, createdAt: new Date().toISOString(), gate: verdict }
  await mkdir(DIR, { recursive: true })
  await writeFile(join(DIR, `${job.id}.json`), `${JSON.stringify(game, null, 2)}\n`)
  job.state = "done"
}

export async function loadCustom(id: string): Promise<CustomGame | null> {
  if (!ID.test(id)) return null
  try {
    return JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8")) as CustomGame
  } catch {
    return null
  }
}

export async function listCustom(): Promise<Array<CustomGame>> {
  let names: Array<string>
  try {
    names = (await readdir(DIR)).filter((n) => n.endsWith(".json"))
  } catch {
    return []
  }
  const games = await Promise.all(names.map((n) => loadCustom(n.slice(0, -".json".length))))
  return games.filter((g): g is CustomGame => g !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteCustom(id: string): Promise<void> {
  if (!ID.test(id)) return
  await rm(join(DIR, `${id}.json`), { force: true })
}
