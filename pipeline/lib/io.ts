import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Answerer, ModelInfo, Persona, Question } from "../../src/lib/types.ts"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const PATHS = {
  questions: join(ROOT, "questions"),
  puzzles: join(ROOT, "puzzles"),
  runs: join(ROOT, "runs"),
  personas: join(ROOT, "data", "personas.json"),
  models: join(ROOT, "data", "models.json"),
  answerers: join(ROOT, "data", "answerers.json"),
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
}

export function loadEnv(): void {
  const file = join(ROOT, ".env")
  if (existsSync(file)) process.loadEnvFile(file)
}

export type QuestionFile = { path: string; questions: Array<Question> }

export async function loadQuestionFiles(): Promise<Array<QuestionFile>> {
  const names = (await readdir(PATHS.questions)).filter((n) => n.endsWith(".json")).sort()
  return Promise.all(
    names.map(async (name) => {
      const path = join(PATHS.questions, name)
      return { path, questions: await readJson<Array<Question>>(path) }
    }),
  )
}

export async function saveQuestionFile(file: QuestionFile): Promise<void> {
  await writeJson(file.path, file.questions)
}

export async function loadCast() {
  const [personas, models, answerers] = await Promise.all([
    readJson<Array<Persona>>(PATHS.personas),
    readJson<Array<ModelInfo>>(PATHS.models),
    readJson<Array<Answerer>>(PATHS.answerers),
  ])
  return {
    personas: new Map(personas.map((p) => [p.id, p])),
    models: new Map(models.map((m) => [m.id, m])),
    answerers,
  }
}

export function puzzlePath(date: string): string {
  return join(PATHS.puzzles, `${date}.json`)
}

export function runPath(date: string): string {
  return join(PATHS.runs, `${date}.json`)
}
