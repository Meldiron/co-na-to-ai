import { answerers, personas } from "../src/lib/cast.ts"
import { pragueDate } from "../src/lib/day.ts"
import type { Puzzle } from "../src/lib/types.ts"
import { askAll } from "./ask.ts"
import { buildPuzzle, type GateResult } from "./build.ts"
import { JUDGE_MODEL } from "./cluster.ts"
import { finalize } from "./finalize.ts"
import { catalogue, client } from "./lib/openrouter.ts"
import { SPARES } from "./lib/roster.ts"

export type CustomGame = Puzzle & { id: string; createdAt: string; gate: GateResult }

export const CUSTOM_ID = /^[a-f0-9]{10}$/

export async function generateCustomGame(
  id: string,
  question: string,
  hooks: { onProgress?: (done: number) => void; onJudging?: () => void } = {},
): Promise<CustomGame> {
  const sdk = client()
  const models = await catalogue()
  const started = Date.now()
  const responses = await askAll({
    sdk,
    catalogue: models,
    answerers,
    personas: new Map(personas.map((p) => [p.id, p])),
    spares: SPARES,
    question,
    onProgress: hooks.onProgress,
  })
  hooks.onJudging?.()
  const askCost = responses.flatMap((r) => r.attempts).reduce((sum, a) => sum + a.costUsd, 0)
  const { grouped, gate, costUsd } = await finalize(sdk, question, responses, { aliasesOnFail: true })
  const puzzle = buildPuzzle({
    date: pragueDate(),
    number: 0,
    questionId: id,
    question,
    responses,
    grouped,
    judgeModel: JUDGE_MODEL,
    costUsd: askCost + costUsd,
    durationMs: Date.now() - started,
  })
  return { ...puzzle, id, createdAt: new Date().toISOString(), gate }
}
